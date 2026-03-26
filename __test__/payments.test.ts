import { beforeAll, describe, expect, it } from "vitest";
import { PaymentsAdminClient, PaymentsUserClient } from "../src";
import {
  AlgorandClient,
  ReadableAddress,
} from "@algorandfoundation/algokit-utils";
import { SendingAddress } from "@algorandfoundation/algokit-utils/transact";

async function getAlgoBalance(
  algorand: AlgorandClient,
  account: ReadableAddress,
): Promise<bigint> {
  const { amount } = await algorand.client.algod.accountInformation(account);
  return amount;
}

const PAYMENTS = 50;

describe("Payments", () => {
  let algorand: AlgorandClient;
  let adminClient: PaymentsAdminClient;
  let userClient: PaymentsUserClient;
  let zeroAlgoSender: SendingAddress;
  let zeroAlgoReceiver: SendingAddress;

  beforeAll(async () => {
    algorand = AlgorandClient.defaultLocalNet();
    const admin = await algorand.account.dispenserFromEnvironment();
    adminClient = await PaymentsAdminClient.create({
      algorand,
      admin,
      supply: 1000n,
      prefundAccounts: BigInt(PAYMENTS * 2 + 2),
      prefundTransactions: BigInt(PAYMENTS + 1),
    });
    zeroAlgoSender = algorand.account.random();
    zeroAlgoReceiver = algorand.account.random();

    await adminClient.instantiateAccount(zeroAlgoSender);
    await adminClient.instantiateAccount(zeroAlgoReceiver);
    await adminClient.addToCirculation(100n, zeroAlgoSender);

    userClient = new PaymentsUserClient(algorand, adminClient.appClient.appId);
  });

  it("payment", async () => {
    expect(await userClient.balance(zeroAlgoSender)).toBe(100n);
    expect(await userClient.balance(zeroAlgoReceiver)).toBe(0n);

    const senderPreAlgo = await getAlgoBalance(algorand, zeroAlgoSender);
    const receiverPreAlgo = await getAlgoBalance(algorand, zeroAlgoReceiver);

    expect(senderPreAlgo).toBe(0n);
    expect(receiverPreAlgo).toBe(0n);

    await userClient.transfer(zeroAlgoSender, zeroAlgoReceiver, 10n);

    const senderPostAlgo = await getAlgoBalance(algorand, zeroAlgoSender);
    const receiverPostAlgo = await getAlgoBalance(algorand, zeroAlgoReceiver);

    expect(senderPostAlgo).toBe(0n);
    expect(receiverPostAlgo).toBe(0n);

    expect(await userClient.balance(zeroAlgoSender)).toBe(90n);
    expect(await userClient.balance(zeroAlgoReceiver)).toBe(10n);
  });

  it(`${PAYMENTS} payments`, async () => {
    const senders = Array.from({ length: PAYMENTS }, () =>
      algorand.account.random(),
    );
    const receivers = Array.from({ length: PAYMENTS }, () =>
      algorand.account.random(),
    );

    for (const sender of senders) {
      await adminClient.instantiateAccount(sender);
      await adminClient.addToCirculation(1n, sender);
    }
    for (const receiver of receivers) {
      await adminClient.instantiateAccount(receiver);
    }

    for (let i = 0; i < PAYMENTS; i++) {
      await userClient.transfer(senders[i], receivers[i], 1n);
    }
  });
});
