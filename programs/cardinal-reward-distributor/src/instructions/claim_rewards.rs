use {
    crate::{errors::ErrorCode, state::*},
    anchor_lang::prelude::*,
    anchor_spl::token::{self, Mint, Token, TokenAccount},
    cardinal_stake_pool::state::{StakeEntry, StakePool},
};

#[derive(Accounts)]
pub struct ClaimRewardsCtx<'info> {
    #[account(mut)]
    reward_entry: Box<Account<'info, RewardEntry>>,
    #[account(constraint = reward_distributor.stake_pool == stake_pool.key())]
    reward_distributor: Box<Account<'info, RewardDistributor>>,

    #[account(constraint = stake_entry.original_mint == reward_entry.mint)]
    stake_entry: Box<Account<'info, StakeEntry>>,
    #[account(constraint = stake_pool.key() == stake_entry.pool)]
    stake_pool: Box<Account<'info, StakePool>>,

    #[account(mut, constraint = reward_mint.key() == reward_distributor.reward_mint @ ErrorCode::InvalidRewardMint)]
    reward_mint: Box<Account<'info, Mint>>,

    #[account(mut, constraint = user_reward_mint_token_account.mint == reward_distributor.reward_mint && user_reward_mint_token_account.owner == user.key() @ ErrorCode::InvalidUserRewardMintTokenAccount)]
    user_reward_mint_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    user: Signer<'info>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
}

pub fn handler<'key, 'accounts, 'remaining, 'info>(ctx: Context<'key, 'accounts, 'remaining, 'info, ClaimRewardsCtx<'info>>) -> Result<()> {
    let reward_entry = &mut ctx.accounts.reward_entry;
    let reward_distributor = &mut ctx.accounts.reward_distributor;
    let stake_pool = reward_distributor.stake_pool;
    let stake_entry = &mut ctx.accounts.stake_entry;
    let reward_distributor_seed = &[REWARD_DISTRIBUTOR_SEED.as_bytes(), stake_pool.as_ref(), &[reward_distributor.bump]];
    let reward_distributor_signer = &[&reward_distributor_seed[..]];

    let reward_amount = reward_distributor.reward_amount;
    let reward_duration_seconds = reward_distributor.reward_duration_seconds;

    let reward_seconds_received = reward_entry.reward_seconds_received;
    if reward_seconds_received <= stake_entry.total_stake_seconds as u64 && (reward_distributor.max_supply == None || reward_distributor.rewards_issued < reward_distributor.max_supply.unwrap()) {
        let mut reward_time_to_receive = (stake_entry.total_stake_seconds as u64).checked_sub(reward_seconds_received).unwrap();
        let mut reward_amount_to_receive = reward_time_to_receive
            .checked_div(reward_duration_seconds)
            .unwrap()
            .checked_mul(reward_amount)
            .unwrap()
            .checked_mul(reward_entry.multiplier)
            .unwrap();

        // if this will go over max supply give rewards up to max supply
        if reward_distributor.max_supply != None && reward_distributor.rewards_issued.checked_add(reward_amount_to_receive).unwrap() >= reward_distributor.max_supply.unwrap() {
            reward_amount_to_receive = reward_distributor.max_supply.unwrap().checked_sub(reward_distributor.rewards_issued).unwrap();

            // this is nuanced about if the rewards are closed, should they get the reward time for that time even though they didnt get any rewards?
            // this only matters if the reward distributor becomes open again and they missed out on some rewards they coudlve gotten
            reward_time_to_receive = reward_amount_to_receive
                .checked_div(reward_amount)
                .unwrap()
                .checked_mul(reward_duration_seconds)
                .unwrap()
                .checked_div(reward_entry.multiplier)
                .unwrap();
        }

        // mint to the user
        let remaining_accs = &mut ctx.remaining_accounts.iter();
        match reward_distributor.kind {
            k if k == RewardDistributorKind::Mint as u8 => {
                let cpi_accounts = token::MintTo {
                    mint: ctx.accounts.reward_mint.to_account_info(),
                    to: ctx.accounts.user_reward_mint_token_account.to_account_info(),
                    authority: reward_distributor.to_account_info(),
                };
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let cpi_context = CpiContext::new(cpi_program, cpi_accounts).with_signer(reward_distributor_signer);
                token::mint_to(cpi_context, reward_amount_to_receive)?;
            }
            k if k == RewardDistributorKind::Treasury as u8 => {
                let reward_distributor_token_account_info = next_account_info(remaining_accs)?;
                let reward_distributor_token_account = Account::<TokenAccount>::try_from(reward_distributor_token_account_info)?;

                if reward_amount_to_receive > reward_distributor_token_account.amount {
                    reward_amount_to_receive = reward_distributor_token_account.amount;

                    // this is nuanced about if the rewards are closed, should they get the reward time for that time even though they didnt get any rewards?
                    // this only matters if the reward distributor becomes open again and they missed out on some rewards they coudlve gotten
                    reward_time_to_receive = reward_amount_to_receive
                        .checked_div(reward_amount)
                        .unwrap()
                        .checked_mul(reward_duration_seconds)
                        .unwrap()
                        .checked_div(reward_entry.multiplier)
                        .unwrap();
                }

                let cpi_accounts = token::Transfer {
                    from: reward_distributor_token_account.to_account_info(),
                    to: ctx.accounts.user_reward_mint_token_account.to_account_info(),
                    authority: reward_distributor.to_account_info(),
                };
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let cpi_context = CpiContext::new(cpi_program, cpi_accounts).with_signer(reward_distributor_signer);
                token::transfer(cpi_context, reward_amount_to_receive)?;
            }
            _ => return Err(error!(ErrorCode::InvalidRewardDistributorKind)),
        }
        // update values
        reward_distributor.rewards_issued = reward_distributor.rewards_issued.checked_add(reward_amount_to_receive).unwrap();
        reward_entry.reward_amount_received = reward_entry.reward_amount_received.checked_add(reward_amount_to_receive).unwrap();
        reward_entry.reward_seconds_received = reward_entry.reward_seconds_received.checked_add(reward_time_to_receive).unwrap();
    }

    Ok(())
}