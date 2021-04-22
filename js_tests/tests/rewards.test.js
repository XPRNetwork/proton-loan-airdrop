// @ts-check
const { loadConfig, Blockchain } = require("@klevoya/hydra");
const {
  setOraclePrices,
  asset2dec,
  compound,
  getRateForAPY,
} = require("./helpers");

const config = loadConfig("hydra.yml");

describe("rewards", () => {
  let blockchain = new Blockchain(config);
  let rewards = blockchain.createAccount(`rewards`);
  let token = blockchain.createAccount(`token`);
  let lpToken = blockchain.createAccount(`proton.swaps`);
  let user1 = blockchain.createAccount(`user1`);
  let user2 = blockchain.createAccount(`user2`);
  const start = new Date(`2001-01-01T00:00:00.000Z`); // avoid leap year

  const resetRewards = async () => {
    blockchain.setCurrentTime(start);

    // reset all token balances because of share / underlying exchange rate
    token.resetTables();
    await token.contract.create({
      issuer: token.accountName,
      maximum_supply: "10000000000.0000 REWARDS",
    });
    await token.contract.issue({
      to: token.accountName,
      quantity: "10000000000.0000 REWARDS",
      memo: "",
    });
    await token.contract.transfer({
      from: token.accountName,
      to: rewards.accountName,
      quantity: `10000000000.0000 REWARDS`,
      memo: `deposit rewards`,
    });

    lpToken.resetTables();
    await lpToken.contract.create({
      issuer: lpToken.accountName,
      maximum_supply: "10000000000.00000000 BTCUSDC",
    });
    await lpToken.contract.issue({
      to: lpToken.accountName,
      quantity: "10000000000.00000000 BTCUSDC",
      memo: "",
    });
    await lpToken.contract.transfer({
      from: lpToken.accountName,
      to: user1.accountName,
      quantity: `1000.00000000 BTCUSDC`,
      memo: ``,
    });
    await lpToken.contract.transfer({
      from: lpToken.accountName,
      to: user2.accountName,
      quantity: `1000.00000000 BTCUSDC`,
      memo: ``,
    });
    await lpToken.contract.create({
      issuer: lpToken.accountName,
      maximum_supply: "10000000000.0000000 DOGEUSD",
    });
    await lpToken.contract.issue({
      to: lpToken.accountName,
      quantity: "10000000000.0000000 DOGEUSD",
      memo: "",
    });
    await lpToken.contract.transfer({
      from: lpToken.accountName,
      to: user1.accountName,
      quantity: `1000.0000000 DOGEUSD`,
      memo: ``,
    });
    await lpToken.contract.transfer({
      from: lpToken.accountName,
      to: user2.accountName,
      quantity: `1000.0000000 DOGEUSD`,
      memo: ``,
    });

    // reset rewards
    rewards.resetTables(`rewards`, `rewards.cfg`);
    await rewards.contract.createstake({
      stake_symbol: {
        sym: `8,BTCUSDC`,
        contract: lpToken.accountName,
      },
      rewards_per_half_second: `0.1000 REWARDS`,
    });
    await rewards.contract.createstake({
      stake_symbol: {
        sym: `7,DOGEUSD`,
        contract: lpToken.accountName,
      },
      rewards_per_half_second: `1.0000 REWARDS`,
    });
    await rewards.contract.open(
      {
        payer: rewards.accountName,
        user: user1.accountName,
        stakes: [`BTCUSDC`, `DOGEUSD`],
      },
      [{ actor: rewards.accountName, permission: `active` }]
    );
    await rewards.contract.open(
      {
        payer: rewards.accountName,
        user: user2.accountName,
        stakes: [`BTCUSDC`, `DOGEUSD`],
      },
      [{ actor: rewards.accountName, permission: `active` }]
    );
  };

  beforeAll(async () => {
    rewards.setContract(blockchain.contractTemplates[`rewards`]);
    token.setContract(blockchain.contractTemplates[`token`]);
    lpToken.setContract(blockchain.contractTemplates[`token`]);

    [rewards, token, lpToken].forEach((acc) =>
      acc.updateAuth(`active`, `owner`, {
        accounts: [
          {
            permission: {
              actor: acc.accountName,
              permission: `eosio.code`,
            },
            weight: 1,
          },
        ],
      })
    );
  });

  it("sets up globals (rewards)", async () => {
    // set reward symbol
    await rewards.contract.initrewards({
      reward_symbol: {
        sym: `4,REWARDS`,
        contract: token.accountName,
      },
    });
  });

  test("pays out single staker rewards correctly", async () => {
    await resetRewards();
    // end is in 1 year
    const end = new Date(`2002-01-01T00:00:00.000Z`);

    await lpToken.contract.transfer(
      {
        from: user1.accountName,
        to: rewards.accountName,
        quantity: `1.00000000 BTCUSDC`,
        memo: ``,
      },
      [{ actor: user1.accountName, permission: `active` }]
    );

    // advance time to end
    blockchain.setCurrentTime(end);

    await rewards.contract[`update.user`](
      {
        user: user1.accountName,
      },
      [{ actor: user1.accountName, permission: `active` }]
    );

    // await rewards.contract.claim(
    //   {
    //     user: user1.accountName,
    //   },
    //   [{ actor: user1.accountName, permission: `active` }]
    // );

    const [user1Rewards] = rewards.getTableRowsScoped(`rewards`)[
      rewards.accountName
    ];
    const blocksDelta = Math.floor((end.getTime() - start.getTime()) / 500);
    const rewardsPerBlock = 1000;
    const totalAmount = rewardsPerBlock * blocksDelta;
    const expectedUser1Rewards = totalAmount;

    // allow little bit of rounding errors
    expect(
      Number.parseInt(user1Rewards.stakes[0].value.accrued_rewards) -
        expectedUser1Rewards
    ).toBeLessThan(1);
    expect(user1Rewards.stakes[0].value).toMatchObject({
      balance: "100000000",
      reward_index: 630.72,
    });

    const rewardsCfg = rewards.getTableRowsScoped(`rewards.cfg`)[
      rewards.accountName
    ];
    expect(rewardsCfg[0]).toMatchObject({
      reward_index: 630.72,
      reward_time: "2002-01-01T00:00:00.000",
      rewards_per_half_second: "1000",
      total_staked: {
        contract: "proton.swaps",
        quantity: "1.00000000 BTCUSDC",
      },
    });
  });
}); // end describe

/**
 * To test:
 * [ ] no double claim
 * [ ] can claim several stakes correctly
 * [ ] two users share the rewards
 * [ ] if nobody staked, no rewards are paid, but time is updated
 */