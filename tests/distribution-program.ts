import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { DistributionProgram } from "../target/types/distribution_program";
import { assert } from "chai";
import { SystemProgram, Transaction, PublicKey } from "@solana/web3.js";

describe("distribution-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .DistributionProgram as Program<DistributionProgram>;
  const provider = anchor.AnchorProvider.env();

  let sender = anchor.web3.Keypair.generate();
  let recipient = new anchor.web3.PublicKey(
    "81WqD2Aam245VkFYQGpKD9AmSKWtv5ad6YwkMvqoRQx9"
  );

  it("sending sol to the main sender", async () => {
    const airdropSignature = await provider.connection.requestAirdrop(
      sender.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);
  });

  it("Transfers SOL directly using SystemProgram", async () => {
    // Use a small amount for the test
    const amount = 10000; // 0.00001 SOL

    // Get initial balances
    const initialRecipientBalance = await provider.connection.getBalance(
      recipient
    );
    const initialSenderBalance = await provider.connection.getBalance(
      sender.publicKey
    );

    console.log("Initial recipient balance:", initialRecipientBalance);
    console.log("Initial sender balance:", initialSenderBalance);
    console.log("Transfer amount:", amount);

    try {
      // Create a direct transfer instruction using SystemProgram
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: recipient,
        lamports: amount,
      });

      // Create and send the transaction
      const transaction = new Transaction().add(transferInstruction);
      const signature = await provider.connection.sendTransaction(transaction, [
        sender,
      ]);

      // Wait for confirmation
      await provider.connection.confirmTransaction(signature);

      console.log("Direct transfer transaction signature:", signature);

      // Verify the balance changes
      const finalRecipientBalance = await provider.connection.getBalance(
        recipient
      );
      const finalSenderBalance = await provider.connection.getBalance(
        sender.publicKey
      );

      console.log("Final recipient balance:", finalRecipientBalance);
      console.log("Final sender balance:", finalSenderBalance);

      assert(
        finalRecipientBalance > initialRecipientBalance,
        "Recipient balance should have increased"
      );
    } catch (error) {
      console.error("Direct transfer failed:", error);
      throw error;
    }
  });

  it("Attempts to use program with direct serialization", async () => {
    const amount = new anchor.BN(10000);

    try {
      console.log("Attempting program call with direct instruction creation");

      // Generate the correct instruction to extract the discriminator
      const ix = await program.methods
        .distribute(amount)
        .accounts({
          from: sender.publicKey,
          to: recipient,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      const discriminator = ix.data.subarray(0, 8);

      // Create the data buffer with discriminator and amount
      const dataLayout = anchor.Borsh.struct([anchor.Borsh.u64("amount")]);
      const dataWithoutDiscriminator = Buffer.alloc(8);
      dataLayout.encode({ amount: amount }, dataWithoutDiscriminator);
      const data = Buffer.concat([discriminator, dataWithoutDiscriminator]);

      console.log("Instruction data buffer:", data);

      // Create the instruction manually
      const keys = [
        { pubkey: sender.publicKey, isWritable: true, isSigner: true },
        { pubkey: recipient, isWritable: true, isSigner: false },
        { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
      ];

      const instruction = {
        programId: program.programId,
        keys,
        data,
      };

      // Send the transaction
      const transaction = new Transaction().add(instruction);
      const signature = await provider.connection.sendTransaction(transaction, [
        sender,
      ]);

      console.log("Program transaction signature:", signature);
      await provider.connection.confirmTransaction(signature);
    } catch (error) {
      console.error("Program call failed:", error);
      console.error("Error details:", error.logs || "No logs available");
    }
  });
});
