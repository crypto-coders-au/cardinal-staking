import type { AccountData } from "@cardinal/common";
import { BorshAccountsCoder, Program, Provider } from "@project-serum/anchor";
import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

import type { STAKE_POOL_PROGRAM, StakePoolData } from ".";
import { STAKE_POOL_ADDRESS, STAKE_POOL_IDL } from ".";
import type {
  IdentifierData,
  StakeAuthorizationData,
  StakeEntryData,
} from "./constants";
import { POOL_OFFSET, STAKER_OFFSET } from "./constants";
import { findIdentifierId } from "./pda";

export const getStakePool = async (
  connection: Connection,
  stakePoolId: PublicKey
): Promise<AccountData<StakePoolData>> => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const provider = new Provider(connection, null, {});
  const stakePoolProgram = new Program<STAKE_POOL_PROGRAM>(
    STAKE_POOL_IDL,
    STAKE_POOL_ADDRESS,
    provider
  );

  const parsed = await stakePoolProgram.account.stakePool.fetch(stakePoolId);
  return {
    parsed,
    pubkey: stakePoolId,
  };
};

export const getStakePools = async (
  connection: Connection,
  stakePoolIds: PublicKey[]
): Promise<AccountData<StakePoolData>[]> => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const provider = new Provider(connection, null, {});
  const stakePoolProgram = new Program<STAKE_POOL_PROGRAM>(
    STAKE_POOL_IDL,
    STAKE_POOL_ADDRESS,
    provider
  );

  const stakePools = (await stakePoolProgram.account.stakePool.fetchMultiple(
    stakePoolIds
  )) as StakePoolData[];
  return stakePools.map((tm, i) => ({
    parsed: tm,
    pubkey: stakePoolIds[i]!,
  }));
};

export const getStakeEntriesForPoolAndUser = async (
  connection: Connection,
  stakePoolId: PublicKey,
  user: PublicKey
): Promise<AccountData<StakeEntryData>[]> => {
  const programAccounts = await connection.getProgramAccounts(
    STAKE_POOL_ADDRESS,
    {
      filters: [
        {
          memcmp: { offset: POOL_OFFSET, bytes: stakePoolId.toBase58() },
        },
        {
          memcmp: { offset: STAKER_OFFSET, bytes: user.toBase58() },
        },
      ],
    }
  );
  const stakeEntryDatas: AccountData<StakeEntryData>[] = [];
  const coder = new BorshAccountsCoder(STAKE_POOL_IDL);
  programAccounts.forEach((account) => {
    try {
      const stakeEntryData: StakeEntryData = coder.decode(
        "stakeEntry",
        account.account.data
      );
      if (
        stakeEntryData &&
        stakeEntryData.lastStaker.toString() !== PublicKey.default.toString()
      ) {
        stakeEntryDatas.push({
          ...account,
          parsed: stakeEntryData,
        });
      }
    } catch (e) {
      // console.log(`Failed to decode token manager data`);
    }
  });

  return stakeEntryDatas.sort((a, b) =>
    a.pubkey.toBase58().localeCompare(b.pubkey.toBase58())
  );
};

export const getStakeEntriesForPool = async (
  connection: Connection,
  stakePoolId: PublicKey
): Promise<AccountData<StakeEntryData>[]> => {
  const programAccounts = await connection.getProgramAccounts(
    STAKE_POOL_ADDRESS,
    {
      filters: [
        {
          memcmp: { offset: POOL_OFFSET, bytes: stakePoolId.toBase58() },
        },
      ],
    }
  );
  const stakeEntryDatas: AccountData<StakeEntryData>[] = [];
  const coder = new BorshAccountsCoder(STAKE_POOL_IDL);
  programAccounts.forEach((account) => {
    try {
      const stakeEntryData: StakeEntryData = coder.decode(
        "stakeEntry",
        account.account.data
      );
      if (
        stakeEntryData &&
        stakeEntryData.lastStaker.toString() !== PublicKey.default.toString()
      ) {
        stakeEntryDatas.push({
          ...account,
          parsed: stakeEntryData,
        });
      }
    } catch (e) {
      // console.log(`Failed to decode token manager data`);
    }
  });

  return stakeEntryDatas.sort((a, b) =>
    a.pubkey.toBase58().localeCompare(b.pubkey.toBase58())
  );
};

export const getStakeEntry = async (
  connection: Connection,
  stakeEntryId: PublicKey
): Promise<AccountData<StakeEntryData>> => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const provider = new Provider(connection, null, {});
  const stakePoolProgram = new Program<STAKE_POOL_PROGRAM>(
    STAKE_POOL_IDL,
    STAKE_POOL_ADDRESS,
    provider
  );

  const parsed = await stakePoolProgram.account.stakeEntry.fetch(stakeEntryId);
  return {
    parsed,
    pubkey: stakeEntryId,
  };
};

export const getStakeEntries = async (
  connection: Connection,
  stakeEntryIds: PublicKey[]
): Promise<AccountData<StakeEntryData>[]> => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const provider = new Provider(connection, null, {});
  const stakePoolProgram = new Program<STAKE_POOL_PROGRAM>(
    STAKE_POOL_IDL,
    STAKE_POOL_ADDRESS,
    provider
  );

  const stakeEntries = (await stakePoolProgram.account.stakeEntry.fetchMultiple(
    stakeEntryIds
  )) as StakePoolData[];
  return stakeEntries.map((tm, i) => ({
    parsed: tm,
    pubkey: stakeEntryIds[i]!,
  }));
};

export const getPoolIdentifier = async (
  connection: Connection
): Promise<AccountData<IdentifierData>> => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const provider = new Provider(connection, null, {});
  const stakePoolProgram = new Program<STAKE_POOL_PROGRAM>(
    STAKE_POOL_IDL,
    STAKE_POOL_ADDRESS,
    provider
  );
  const [identifierId] = await findIdentifierId();
  const parsed = await stakePoolProgram.account.identifier.fetch(identifierId);
  return {
    parsed,
    pubkey: identifierId,
  };
};

export const getStakeAuthorization = async (
  connection: Connection,
  stakeAuthorizationId: PublicKey
): Promise<AccountData<StakeAuthorizationData>> => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const provider = new Provider(connection, null, {});
  const stakePoolProgram = new Program<STAKE_POOL_PROGRAM>(
    STAKE_POOL_IDL,
    STAKE_POOL_ADDRESS,
    provider
  );
  const parsed = await stakePoolProgram.account.stakeAuthorizationRecord.fetch(
    stakeAuthorizationId
  );
  return {
    parsed,
    pubkey: stakeAuthorizationId,
  };
};