import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { DistributionProgram } from "../target/types/distribution_program";
import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";

describe("distribution-program", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .DistributionProgram as Program<DistributionProgram>;
  const provider = anchor.AnchorProvider.env();

  const authority = anchor.web3.Keypair.generate();
  const depositor = anchor.web3.Keypair.generate();
  const recipient = anchor.web3.Keypair.generate();

  let treasury;
  let treasuryAccount;
  let treasuryBump;

  before(async () => {
    const authorityAirdrop = await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(authorityAirdrop);

    const depositorAirdrop = await provider.connection.requestAirdrop(
      depositor.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(depositorAirdrop);

    [treasury, treasuryBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), authority.publicKey.toBuffer()],
      program.programId
    );

    [treasuryAccount] = await PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), authority.publicKey.toBuffer()],
      program.programId
    );

    console.log("Authority:", authority.publicKey.toString());
    console.log("Treasury:", treasury.toString());
    console.log("Treasury Account:", treasuryAccount.toString());
    console.log("Recipient:", recipient.publicKey.toString());
  });

  it("Initializes a treasury", async () => {
    try {
      const tx = await program.methods
        .initializeTreasury()
        .accounts({
          authority: authority.publicKey,
          treasury: treasury,
          treasuryAccount: treasuryAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Initialize treasury transaction signature:", tx);

      const treasuryData = await program.account.treasury.fetch(treasury);
      assert.equal(
        treasuryData.authority.toString(),
        authority.publicKey.toString(),
        "Treasury authority should match"
      );
      assert.equal(
        treasuryData.bump,
        treasuryBump,
        "Treasury bump should match"
      );
    } catch (error) {
      console.error("Initialize treasury failed:", error);
      throw error;
    }
  });

  it("Deposits SOL into the treasury", async () => {
    const initialTreasuryBalance = await provider.connection.getBalance(
      treasuryAccount
    );
    console.log("Initial treasury balance:", initialTreasuryBalance);

    const depositAmount = new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL);

    try {
      const tx = await program.methods
        .deposit(depositAmount)
        .accounts({
          depositor: depositor.publicKey,
          treasuryAccount: treasuryAccount,
          treasury: treasury,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();

      console.log("Deposit transaction signature:", tx);

      const finalTreasuryBalance = await provider.connection.getBalance(
        treasuryAccount
      );
      console.log("Final treasury balance:", finalTreasuryBalance);

      assert(
        finalTreasuryBalance > initialTreasuryBalance,
        "Treasury balance should have increased"
      );
      assert.equal(
        finalTreasuryBalance - initialTreasuryBalance,
        depositAmount.toNumber(),
        "Treasury balance should have increased by the deposit amount"
      );
    } catch (error) {
      console.error("Deposit failed:", error);
      throw error;
    }
  });

  it("Distributes SOL from the treasury", async () => {
    const initialTreasuryBalance = await provider.connection.getBalance(
      treasuryAccount
    );
    const initialRecipientBalance = await provider.connection.getBalance(
      recipient.publicKey
    );

    console.log("Initial treasury balance:", initialTreasuryBalance);
    console.log("Initial recipient balance:", initialRecipientBalance);

    const distributeAmount = new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL);

    try {
      const tx = await program.methods
        .distribute(distributeAmount, recipient.publicKey)
        .accounts({
          authority: authority.publicKey,
          treasuryAccount: treasuryAccount,
          treasury: treasury,
          recipient: recipient.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Distribute transaction signature:", tx);

      const finalTreasuryBalance = await provider.connection.getBalance(
        treasuryAccount
      );
      const finalRecipientBalance = await provider.connection.getBalance(
        recipient.publicKey
      );

      console.log("Final treasury balance:", finalTreasuryBalance);
      console.log("Final recipient balance:", finalRecipientBalance);

      assert.equal(
        initialTreasuryBalance - finalTreasuryBalance,
        distributeAmount.toNumber(),
        "Treasury balance should have decreased by the distribute amount"
      );

      assert.equal(
        finalRecipientBalance - initialRecipientBalance,
        distributeAmount.toNumber(),
        "Recipient balance should have increased by the distribute amount"
      );
    } catch (error) {
      console.error("Distribution failed:", error);
      throw error;
    }
  });

  it("Fails to distribute if not the authority", async () => {
    let failed = false;
    const distributeAmount = new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL);

    try {
      await program.methods
        .distribute(distributeAmount, recipient.publicKey)
        .accounts({
          authority: depositor.publicKey,
          treasuryAccount: treasuryAccount,
          treasury: treasury,
          recipient: recipient.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();

      console.log("This should have failed but didn't!");
    } catch (error) {
      failed = true;
      console.log(
        "Failed as expected when unauthorized user tries to distribute"
      );
    }

    assert(failed, "Transaction should have failed with unauthorized error");
  });
});
