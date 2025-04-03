use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;

declare_id!("4tXE3MBtiraiLALMezP1YmMm22QFofDraqzRAeUqB8dx");

#[program]
pub mod distribution_program {
    use super::*;

    pub fn distribute(ctx: Context<Distribute>, amount: u64) -> Result<()> {
        let ix = system_instruction::transfer(
            &ctx.accounts.sender.key(),
            &ctx.accounts.recipient.key(),
            amount,
        );

        invoke(
            &ix,
            &[
                ctx.accounts.sender.to_account_info(),
                ctx.accounts.recipient.to_account_info(),
            ],
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Distribute<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: This is safe because we are only transferring SOL
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
