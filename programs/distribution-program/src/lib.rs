use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::system_instruction;

declare_id!("4tXE3MBtiraiLALMezP1YmMm22QFofDraqzRAeUqB8dx");

#[program]
pub mod distribution_program {
    use super::*;

    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.bump = *ctx.bumps.get("treasury").unwrap();
        msg!("Treasury initialized with authority: {}", treasury.authority);
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let ix = system_instruction::transfer(
            &ctx.accounts.depositor.key(),
            &ctx.accounts.treasury_account.key(),
            amount,
        );

        invoke_signed(
            &ix,
            &[
                ctx.accounts.depositor.to_account_info(),
                ctx.accounts.treasury_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[],
        )?;

        msg!("Deposited {} lamports to treasury", amount);
        Ok(())
    }

    pub fn distribute(
        ctx: Context<Distribute>,
        amount: u64,
        recipient_address: Pubkey,
    ) -> Result<()> {
        let treasury = &ctx.accounts.treasury;
        let seeds = &[
            b"treasury".as_ref(),
            treasury.authority.as_ref(),
            &[treasury.bump],
        ];
        let signer = &[&seeds[..]];

        let ix = system_instruction::transfer(
            &ctx.accounts.treasury_account.key(),
            &recipient_address,
            amount,
        );

        invoke_signed(
            &ix,
            &[
                ctx.accounts.treasury_account.to_account_info(),
                ctx.accounts.recipient.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;

        msg!("Distributed {} lamports to {}", amount, recipient_address);
        Ok(())
    }
}

#[account]
pub struct Treasury {
    pub authority: Pubkey,   
    pub bump: u8,     
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1, // discriminator + pubkey + bump
        seeds = [b"treasury", authority.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    /// CHECK: This is the treasury's PDA account that will hold SOL, derived from the same seeds as the treasury account
    #[account(
        seeds = [b"treasury", authority.key().as_ref()],
        bump,
    )]
    pub treasury_account: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    
    /// CHECK: This is the treasury PDA account that holds SOL, verified through seeds
    #[account(
        mut,
        seeds = [b"treasury", treasury.authority.as_ref()],
        bump = treasury.bump,
    )]
    pub treasury_account: UncheckedAccount<'info>,
    
    pub treasury: Account<'info, Treasury>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Distribute<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: This is the treasury PDA account that holds SOL, verified through seeds and the authority constraint
    #[account(
        mut,
        seeds = [b"treasury", treasury.authority.as_ref()],
        bump = treasury.bump,
        constraint = authority.key() == treasury.authority @ ErrorCode::Unauthorized
    )]
    pub treasury_account: UncheckedAccount<'info>,
    
    pub treasury: Account<'info, Treasury>,
    
    /// CHECK: This is the account that will receive the SOL, safe because we're only sending SOL to it
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
}