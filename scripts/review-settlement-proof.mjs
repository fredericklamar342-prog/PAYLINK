import { privateKeyToAccount } from "viem/accounts";
import { keccak256, stringToHex, verifyTypedData } from "viem";

const account = privateKeyToAccount("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
const chainId = 10143;
const requestId = "11111111-1111-4111-8111-111111111111";
const transactionHash = `0x${"ab".repeat(32)}`;
const recipient = "0x2222222222222222222222222222222222222222";
const types = { PayLinkSettlement: [
  { name: "requestId", type: "string" }, { name: "transactionHash", type: "bytes32" },
  { name: "chainId", type: "uint256" }, { name: "token", type: "string" },
  { name: "recipient", type: "address" }, { name: "amountAtomic", type: "uint256" },
] };
const domain = (deployment, origin) => ({ name: "PayLink Stored Payment", version: "1", chainId,
  salt: keccak256(stringToHex(`paylink-settlement:${deployment}:${origin}`)) });
const message = { requestId, transactionHash, chainId, token: "USDC", recipient, amountAtomic: 1234567n };
const staging = domain("staging", "https://staging.example.invalid");
const production = domain("production", "https://production.example.invalid");
const signature = await account.signTypedData({ domain: staging, types, primaryType: "PayLinkSettlement", message });
const check = async (name, expected, args) => {
  const actual = await verifyTypedData({ address: account.address, types, primaryType: "PayLinkSettlement", signature, ...args });
  if (actual !== expected) throw new Error(`${name}: expected ${expected}, received ${actual}`);
  console.log(`PASS ${name}`);
};
await check("valid staging proof", true, { domain: staging, message });
await check("wrong environment/origin replay", false, { domain: production, message });
await check("wrong transaction hash", false, { domain: staging,
  message: { ...message, transactionHash: `0x${"cd".repeat(32)}` } });
await check("wrong request UUID", false, { domain: staging,
  message: { ...message, requestId: "33333333-3333-4333-8333-333333333333" } });
await check("wrong chain", false, { domain: { ...staging, chainId: 143 }, message: { ...message, chainId: 143 } });
await check("wrong amount", false, { domain: staging, message: { ...message, amountAtomic: 1234568n } });
console.log("PASS settlement proof adversarial suite (6 assertions)");
