> ## Documentation Index
> Fetch the complete documentation index at: https://docs.starknet.io/llms.txt
> Use this file to discover all available pages before exploring further.

# Setting up your development environment

<Warning>
  If you encounter an issue while following this tutorial, see [Troubleshooting](/build/quickstart/appendix#troubleshooting).
</Warning>

## Introduction

Welcome to the first installment of the Deploy your first contract guide! 🥇

As a popular phrase (often attributed to Abraham Lincoln) says, "Give me six hours to chop down a tree, and I will spend the first four sharpening the axe".
The first installment of the series will therefore guide you through setting up your development environment, which will include the three most recommended tools to begin developing on Starknet:

* *Scarb*, a build toolchain and package manager for Cairo and Starknet ecosystems

* *Starknet Foundry*, the go-to framework for building and testing Starknet Smart Contracts

* *Starknet Devnet*, a Rust implementation of a local Starknet node

<Tip>
  To review all Starknet developer tools, see [Developer tools](/learn/cheatsheets/tools).
</Tip>

## Setting up your environment on MacOS and Linux

On MacOS and Linux, Scarb, Starknet Foundry and Starknet Devnet can be easily installed using the [Starkup installer](https://github.com/software-mansion/starkup) by running:

```bash  theme={null}
   curl --proto '=https' --tlsv1.2 -sSf https://sh.starkup.sh | sh
```

and following the onscreen instructions.

<Note>
  If you prefer to install the tools manually or encounter issues with Starkup, see [Setting up your environment manually on MacOS and Linux](/build/quickstart/appendix#setting-up-your-environment-manually-on-macos-and-linux).
</Note>

You can verify that all three tools are installed correctly by running:

```bash  theme={null}
   scarb --version
   snforge --version && sncast --version
   starknet-devnet --version
```

If the installation was successful, the result should resemble the following:

```console  theme={null}
scarb 2.11.4 (c0ef5ec6a 2025-04-09)
cairo: 2.11.4 (https://crates.io/crates/cairo-lang-compiler/2.11.4)
sierra: 1.7.0

snforge 0.48.1
sncast 0.48.1

starknet-devnet 0.4.3
```

<Note>
  Starkup installs Scarb, Starknet Foundry, and Starknet Devnet on MacOS and Linux via the [`asdf` version manager](https://asdf-vm.com/), which allows to easily switch between their different versions, both globally and per project (see full details in the [`asdf` documentation](https://asdf-vm.com/manage/commands.html) or by running `asdf --help`). Alongside Scarb and Starknet Foundry, Starkup uses `asdf` to install additional useful tools, including the [Universal Sierra Compiler](https://github.com/software-mansion/universal-sierra-compiler), [Cairo Profiler](https://github.com/software-mansion/cairo-profiler), [Cairo Coverage](https://github.com/software-mansion/cairo-coverage), and [CairoLS](https://github.com/software-mansion/cairols).

  If you encounter any issues while using it or have any requests, please help by [submitting an issue](https://github.com/software-mansion/starkup/issues/new).
</Note>

## Setting up your environment on Windows

Setting up Scarb and Starknet Foundry on Windows requires configuring the Windows Subsystem for Linux (WSL) and installing the tools inside a Linux distribution such as Ubuntu.

### Installing WSL and Ubuntu

1. Open PowerShell as administrator and run:

   ```bash  theme={null}
   wsl --install
   ```

   This command installs WSL along with the default Ubuntu distribution. If WSL or virtualization is not yet enabled, reboot and re-run the command as needed.

2. Restart your computer when prompted.

3. After reboot, launch Ubuntu from the Start menu. On the first launch, create a UNIX username and password when prompted.

<Note>
  If `wsl --install` does not work, enable WSL manually by running:

  ```bash  theme={null}
  dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
  dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
  ```

  and installing Ubuntu from the [Microsoft Store](https://aka.ms/wslstore).
</Note>

### Installing prerequisites in Ubuntu

1. Open the Ubuntu terminal and run:

   ```bash  theme={null}
   sudo apt update
   sudo apt install -y curl git build-essential
   ```

### Installing Homebrew

1. Run the Homebrew install script:

   ```bash  theme={null}
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. Add Homebrew to your shell environment:

   ```bash  theme={null}
   echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> ~/.profile
   source ~/.profile
   ```

3. Verify that Homebrew was installed correctly:

   ```bash  theme={null}
   brew --version
   ```

### Installing `asdf`

<Note>
  Using `asdf` allows you to easily switch between versions of Scarb, Starknet Foundry, and Starknet Devnet globally or per project.
</Note>

1. Install `asdf` using Homebrew:

   ```bash  theme={null}
   brew install asdf
   ```

2. Add `asdf` to your shell:

   ```bash  theme={null}
   echo '. "$(brew --prefix asdf)/libexec/asdf.sh"' >> ~/.bashrc
   source ~/.bashrc
   ```

3. Verify that `asdf` is installed correctly:

   ```bash  theme={null}
   asdf --version
   ```

### Installing Scarb, Starknet Foundry, and Starknet Devnet

1. Add the Scarb plugin and install the latest Scarb version:

   ```bash  theme={null}
   asdf plugin add scarb
   asdf install scarb latest
   asdf set -u scarb latest
   ```

2. Add the Starknet Foundry plugin and install the latest Starknet Foundry version:

   ```bash  theme={null}
   asdf plugin add starknet-foundry
   asdf install starknet-foundry latest
   asdf set -u starknet-foundry latest
   ```

3. Add the Starknet Devnet plugin and install the latest Starknet Devnet version:

   ```bash  theme={null}
   asdf plugin add starknet-devnet
   asdf install starknet-devnet latest
   asdf set -u starknet-devnet latest
   ```

4. Restart your terminal and verify that Scarb, Starknet Foundry, and Starknet Devnet were installed correctly:

   ```bash  theme={null}
   scarb --version
   snforge --version && sncast --version
   starknet-devnet --version
   ```

   <Tip>
     If `scarb`, `snforge`, or `starknet-devnet` are not recognized, try running `source ~/.bashrc` or restarting your terminal.
   </Tip>


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.starknet.io/llms.txt
> Use this file to discover all available pages before exploring further.

# Creating and understanding the HelloStarknet contract

<Warning>
  If you encounter an issue while following this tutorial, see [Troubleshooting](/build/quickstart/appendix#troubleshooting).
</Warning>

## Introduction

Welcome to the second installment of the *Deploy your first contract* guide! 🥇

Starknet contracts are a special superset of Cairo programs that are run by the Starknet sequencer, and as such, have access to Starknet's state. This installment of the series will therefore walk you though generating and understanding Scarb's default `HelloStarknet` contract, which will be used throughout the following installments.

<Tip>
  To learn more about Starknet smart contracts, see the [Cairo book](https://book.cairo-lang.org/ch100-00-introduction-to-smart-contracts.html).
</Tip>

## Creating `HelloStarknet`

Scarb's default `HelloStarknet` contract can be generated by simply running:

```bash  theme={null}
scarb new hello_starknet
```

and selecting to set up the `Starknet Foundry (default)` test runner. If successful, this should create a new `hello_starknet` directory with the following structure:

```
hello_starknet
|- Scarb.lock 
|- Scarb.toml 
|- snfoundry.toml 
|- src 
    |- lib.cairo
|- tests
    |- test_contract.cairo
```

## Understanding `HelloStarknet`

For the purpose of this tutorial, you can ignore all files in the `hello_starknet` directory other than `hello_starknet/src/lib.cairo`, which holds the contract's code:

```rust  theme={null}
/// Interface representing `HelloContract`.
/// This interface allows modification and retrieval of the contract balance.
#[starknet::interface]
pub trait IHelloStarknet<TContractState> {
    /// Increase contract balance.
    fn increase_balance(ref self: TContractState, amount: felt252);
    /// Retrieve contract balance.
    fn get_balance(self: @TContractState) -> felt252;
}

/// Simple contract for managing balance.
#[starknet::contract]
mod HelloStarknet {
    use core::starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        balance: felt252,
    }

    #[abi(embed_v0)]
    impl HelloStarknetImpl of super::IHelloStarknet<ContractState> {
        fn increase_balance(ref self: ContractState, amount: felt252) {
            assert(amount != 0, 'Amount cannot be 0');
            self.balance.write(self.balance.read() + amount);
        }

        fn get_balance(self: @ContractState) -> felt252 {
            self.balance.read()
        }
    }
}
```

As its comments read, `HelloStarknet` is a simple contract for managing balance. Specifically:

1. The contract is defined by encapsulating state and logic within a module annotated with the `#[starknet::contract]` attribute.
2. The logic that the contract exposes to the outside world is represented by its interface trait, annotated with the `#[starknet::interface]` attribute. Here, our contract defines and publicly exposes the functions `increase_balance` and `get_balance`.
3. The state is defined within the `Storage` struct, which is always initialized empty. Here, our struct contains a single field called `balance` of type `felt252`.
4. The logic itself is defined in the implementation block and annotated with the `#[abi(embed_v0)]` attribute to expose the implementations to the outside world. Here, `increase_balance` uses the `write` method to increase `balance` by `amount` and `get_balance` uses the `read` method to return the value of `balance`.

Once deployed, each value stored in the `HelloStarknet` contract's storage will be recorded in Starknet's history.

<Tip>
  To review examples of more advanced contracts, see [Starknet By Example](/build/starknet-by-example/index).
</Tip>


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.starknet.io/llms.txt
> Use this file to discover all available pages before exploring further.

# Deploying the HelloStarknet contract locally

<Warning>
  If you encounter an issue while following this tutorial, see [Troubleshooting](/build/quickstart/appendix#troubleshooting).
</Warning>

## Introduction

Welcome to the third installment of the *Deploy your first contract* guide! 🥇

Local networks, also known as development networks or *devnets*, enable a fast and private development process, making them ideal for taking your first Starknet steps. This installment of the series will therefore guide you through the steps necessary to declare, deploy, and interact with the `HelloStarknet` contract on your very own local instance of Starknet.

## Initializing a local Starknet instance

A local Starknet instance can be easily initialized using Starknet Devnet by simply running:

```bash  theme={null}
starknet-devnet --seed=0
```

<Note>
  The `--seed` option is used to force consistent addresses of predeployed account (see more details below).
</Note>

If successful, the result should resemble the following:

```console  theme={null}
Chain ID: SN_SEPOLIA (0x534e5f5345504f4c4941)

Predeployed FeeToken
ETH Address: 0x49D36570D4E46F48E99674BD3FCC84644DDD6B96F7C741B1562B82F9E004DC7
Class Hash: 0x9524A94B41C4440A16FD96D7C1EF6AD6F44C1C013E96662734502CD4EE9B1F
STRK Address: 0x4718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D
Class Hash: 0x76791EF97C042F81FBF352AD95F39A22554EE8D7927B2CE3C681F3418B5206A

Predeployed UDC
Address: 0x41A78E741E5AF2FEC34B695679BC6891742439F7AFB8484ECD7766661AD02BF
Class Hash: 0x7B3E05F48F0C69E4A65CE5E076A66271A527AFF2C34CE1083EC6E1526997A69

...
```

<Note>
  Starknet Devnet should keep running for the following sections to work.
</Note>

## Fetching a predeployed account

<Tip>
  To learn more about Starknet accounts, check out the [Accounts section](/learn/protocol/accounts/).
</Tip>

To interact with your local Starknet instance, you first need an account. Luckily, the result of initializing a local Starknet instance using Starknet Devnet should also include a list of predeployed accounts that resembles the following:

```console  theme={null}
| Account address |  0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691
| Private key     |  0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9
| Public key      |  0x039d9e6ce352ad4530a0ef5d5a18fd3303c3606a7fa6ac5b620020ad681cc33b

| Account address |  0x078662e7352d062084b0010068b99288486c2d8b914f6e2a55ce945f8792c8b1
| Private key     |  0x000000000000000000000000000000000e1406455b7d66b1690803be066cbe5e
| Public key      |  0x007a1bb2744a7dd29bffd44341dbd78008adb4bc11733601e7eddff322ada9cb

...
```

This allows to avoid creating and deploying new accounts, and instead simply importing them to Starknet Foundry. To import your local node's first predeployed account, use a new terminal window to navigate into the `hello_starknet` directory created in [Generating `HelloStarknet`](/build/quickstart/hellostarknet#creating-hellostarknet) and run:

```bash  theme={null}
sncast account import \
    --address=0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691 \
    --type=oz \
    --url=http://127.0.0.1:5050 \
    --private-key=0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9 \
    --add-profile=devnet \
    --silent
```

<Tip>
  To learn more about `sncast account import`, see the [Starknet Foundry documentation](https://foundry-rs.github.io/starknet-foundry/appendix/sncast/account/import.html).
</Tip>

If successful, the result should resemble the following:

```console  theme={null}
Success: Account imported successfully

Account Name: account-1
Add Profile:  Profile devnet successfully added to /app/snfoundry.toml
```

## Declaring `HelloStarknet` locally

Before a contract can be deployed on Starknet, its compiled code needs to be submitted to the network (also known as *declaring* it).

<Tip>
  To learn more about distinction between deploying a contract and declaring it, see [the Cairo Book](https://book.cairo-lang.org/ch100-01-contracts-classes-and-instances.html).
</Tip>

To declare the `HelloStarknet` contract, run:

```bash  theme={null}
sncast --profile=devnet declare \
    --contract-name=HelloStarknet
```

If successful, the result should resemble the following:

```console  theme={null}
Success: Declaration completed

Class Hash:       0x51e0d3b26fb79035afdc64d2214eb18291629b4f2ef132e79c3f3fbe1ba57c4
Transaction Hash: 0x76e28641d96ee0788f5a960931ee717c5dae36f95f227c02d5578a6898d8af3
```

where `class_hash` is the contract's class hash, which can then be used to deploy an instance of it.

<Tip>
  To learn more about the class hashes, check out [the Cairo Book](https://book.cairo-lang.org/ch100-01-contracts-classes-and-instances.html).
</Tip>

## Deploying `HelloStarknet` locally

With `HelloStarknet` declared, you can now deploy an instance of it by running:

```bash  theme={null}
sncast --profile=devnet deploy \
    --class-hash=0x051e0d3b26fb79035afdc64d2214eb18291629b4f2ef132e79c3f3fbe1ba57c4 \
    --salt=0
```

<Note>
  The `--salt` option is used to force a consistent address for the deployed contract.
</Note>

If successful, the result should resemble the following:

```console  theme={null}
Success: Deployment completed

Contract Address: 0x04035c4db7822523478996bfc2b80d925e671279bb99ed1fb4e4fcc222e344e6
Transaction Hash: 0x04d11358b809c7b8a5aae1a1cf0e72e0b436fb2d0a2dd1a26d009fec7aa74280
```

## Interacting with `HelloStarknet` locally

Now that your instance of `HelloStarknet` is deployed, you can interact with via its functions by either calling or invoking them.

Calling is used for read functions that don't modify their contract's storage, and allows querying a smart contract function without sending a transaction. For example, you can call `HelloStarknet`'s `get_balance` function by running:

```bash  theme={null}
sncast --profile=devnet call \
    --contract-address=0x04035c4db7822523478996bfc2b80d925e671279bb99ed1fb4e4fcc222e344e6 \
    --function=get_balance
```

If successful, the result should resemble the following:

```console  theme={null}
Success: Call completed

Response:     0x0
Response Raw: [0x0]
```

Invoking is used for write functions that modify their contract's storage, and submits a transaction to the network that changes its state. For example, you can invoke `HelloStarknet`'s `increase_balance` function by running:

```bash  theme={null}
sncast --profile=devnet invoke \
    --contract-address=0x04035c4db7822523478996bfc2b80d925e671279bb99ed1fb4e4fcc222e344e6 \
    --function=increase_balance \
    --arguments=42
```

If successful, the result should resemble the following:

```console  theme={null}
Success: Invoke completed

Transaction Hash: 0x02691af0fb2b720b27ae17c844d72244b8fc35f3a3d57b6549736d9a88f8f014
```

You can verify that your deployed contract's storage — and by extension, the state of your local Starknet instance — has indeed changed by calling `get_balance` again. If all goes well, the result should resemble the following ($42_{10} = 2a_{16}$):

```console  theme={null}
Success: Call completed

Response:     0x2a
Response Raw: [0x2a]
```

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.starknet.io/llms.txt
> Use this file to discover all available pages before exploring further.

# Deploying the HelloStarknet contract on Starknet Sepolia

<Warning>
  If you encounter an issue while following this tutorial, see [Troubleshooting](/build/quickstart/appendix#troubleshooting).
</Warning>

## Introduction

Welcome to the fourth installment of the *Deploy your first contract* guide! 🥇

Starknet Sepolia is Starknet's testnet environment designed to provide developers with a testing ground that mirrors the behavior of the Starknet Mainnet while being connected to the Ethereum Sepolia testnet, making it ideal for debugging and optimizing your code before deploying it to production. This installment of the series will therefore guide you through the steps necessary to deploy and interact with the `HelloStarknet` contract on Starknet Sepolia.

## Deploying a new Sepolia account

Similar to interacting with a Starknet Devnet instance, to interact with Starknet Sepolia you first need an account. However, instead fetching a predeployed Sepolia account, we will create a *new* account and deploy it using `sncast` ourselves.

<Note>
  To learn how to fetch a predeployed Sepolia account, see [Fetching a predeployed Sepolia account](/build/quickstart/appendix#fetching-a-predeployed-sepolia-account).
</Note>

To create the account's information (private key, address, etc.), navigate into the `hello_starknet` directory created in [Generating `HelloStarknet`](/build/quickstart/hellostarknet#generating-hellostarknet) and run:

```bash  theme={null}
sncast account create \
    --network=sepolia \
    --name=sepolia
```

When run, the command shows instructions on how to prefund the account before proceeding, which can be done using the [Starknet Sepolia faucet](https://starknet-faucet.vercel.app/).

<Note>
  Prefunding the account is required because deploying an account involves sending a `DEPLOY_ACCOUNT` transaction, which requires the account to contain enough STRK to pay for the transaction fee.
</Note>

Once your account is funded, you can deploy it by running:

```bash  theme={null}
sncast account deploy \
    --network sepolia \
    --name sepolia \
    --silent
```

If successful, the result should resemble the following:

```console  theme={null}
Success: Account deployed

Transaction Hash: 0x01340c0328b037bab85d53dd1b3b8040b0e0f4be58a42a94f554c9bf6e5bf30d

To see invocation details, visit:
transaction: https://sepolia.starkscan.co/tx/0x01340c0328b037bab85d53dd1b3b8040b0e0f4be58a42a94f554c9bf6e5bf30d
```

## Deploying `HelloStarknet` on Sepolia

Unlike when using a Starknet Devnet instance, there's no need for us to declare `HelloStarknet` on Sepolia as it has already been declared before (remember: declaration is a one-time process for each unique contract code). To verify that, you can try declaring it by navigating into the `hello_starknet` directory created in [Generating `HelloStarknet`](/build/quickstart/hellostarknet#generating-hellostarknet), running:

```bash  theme={null}
sncast --account=sepolia declare \
    --contract-name=HelloStarknet \
    --network=sepolia
```

The result should resemble to the following:

```console  theme={null}
command: declare
error: Transaction execution error = TransactionExecutionErrorData {
    transaction_index: 0,
    execution_error: Message(
        "Class with hash 0x051e0d3b26fb79035afdc64d2214eb18291629b4f2ef132e79c3f3fbe1ba57c4 is already declared."
    )
}
```

With `HelloStarknet` already declared, you can deploy an instance of it by running:

```bash  theme={null}
sncast --account=sepolia deploy \
    --class-hash=0x051e0d3b26fb79035afdc64d2214eb18291629b4f2ef132e79c3f3fbe1ba57c4 \
    --network=sepolia
```

If successful, the result should resemble the following:

```console  theme={null}
Success: Deployment completed

Contract Address: 0x05fe561f0907f61b1099ba64ee18a5250606d43d00d4f296ba622d287ceb2538
Transaction Hash: 0x0723a63261d2df60f571df8a2b8c8c64694278aae66481a0584445c03234d83f

To see deployment details, visit:
contract: https://sepolia.starkscan.co/contract/0x05fe561f0907f61b1099ba64ee18a5250606d43d00d4f296ba622d287ceb2538
transaction: https://sepolia.starkscan.co/tx/0x0723a63261d2df60f571df8a2b8c8c64694278aae66481a0584445c03234d83f
```

<Warning>
  Your deployed contract's address will be different than the one listed above. Make sure to use the address of your own deployed contract in the following section.
</Warning>

## Interacting with `HelloStarknet` on Sepolia

Once your instance of `HelloStarknet` is deployed, you can invoke its `increase_balance` function by running:

```bash  theme={null}
sncast --account=sepolia invoke \
    --contract-address=<YOUR_CONTRACT_ADDRESS> \
    --function=increase_balance \
    --arguments=66 \
    --network=sepolia
```

If successful, the result should resemble the following:

```console  theme={null}
Success: Invoke completed

Transaction Hash: 0x02b900ba6bfb6a7d256d34c5d3a895abbfa0805d23f80253958e101069700020

To see invocation details, visit:
transaction: https://sepolia.starkscan.co/tx/0x02b900ba6bfb6a7d256d34c5d3a895abbfa0805d23f80253958e101069700020
```

Once the invoke transaction is accepted on Starknet Sepolia, you can call your deployed contract's `get_balance` function to confirm that your deployed contract's storage — and by extension, the state of Starknet Sepolia — has indeed changed, by running:

```bash  theme={null}
sncast call \
    --contract-address=<YOUR_CONTRACT_ADDRESS> \
    --function=get_balance \
    --network=sepolia
```

If all goes well, the result should resemble the following ($66_{10} = 42_{16}$):

```console  theme={null}
Success: Call completed

Response:     0x42
Response Raw: [0x42]
```
> ## Documentation Index
> Fetch the complete documentation index at: https://docs.starknet.io/llms.txt
> Use this file to discover all available pages before exploring further.

# Recommended next steps after deploying your first contract

# Introduction

Welcome to the fifth and final installment of the *Deploy your first contract* guide! 🥇

By now you've successfully declared, deployed, and interacted with the `HelloStarknet`, both on Starknet Sepolia and locally (way to go!).
This last installment of the series will therefore list the various resources you can dive into next.

## Interactive tutorials

* [Starklings](https://starklings.app/)
* [Speedrun Stark](https://speedrunstark.com/)

## Essential learning materials

* [Starknet By Example](/build/starknet-by-example/index)
* [Corelib documentation](/build/corelib/intro)
* [Cairo Book](https://book.cairo-lang.org)
* [Starknet protocol](/learn/protocol/intro)
* [Starknet cheatsheets](/learn/cheatsheets/chain-info)
* [Starknet Basecamp Hub](https://starknet.notion.site/Starknet-Basecamp-Hub-1541b3c1f49f439da872d3d71647d834)

## Core tools documentations

* [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry)
* [Scarb](https://docs.swmansion.com/scarb/docs.html)
* [Starknet Devnet](https://0xspaceshard.github.io/starknet-devnet/docs/intro)

# Summary

Good luck and welcome aboard! We can't wait to see the new and innovative things you'll bring to Starknet 🌟

The journey from your first contract to becoming a Starknet expert is exciting. Take it step by step, stay curious, and don't hesitate to ask for help along the way!

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.starknet.io/llms.txt
> Use this file to discover all available pages before exploring further.

# Deploy your first Starknet contract guide appendix

## Setting up your environment manually on MacOS and Linux

### Installing WSL and Ubuntu

Setting up Scarb and Starknet Foundry on Windows requires configuring the Windows Subsystem for Linux (WSL) and installing the tools inside a Linux distribution such as Ubuntu:

1. Open PowerShell as administrator and run:

   ```bash  theme={null}
   wsl --install
   ```

   This command installs WSL along with the default Ubuntu distribution.
   If WSL or virtualization is not yet enabled, reboot and re-run the command as needed.

   <Note>
     If `wsl --install` does not work, enable WSL manually by running:

     ```bash  theme={null}
     dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
     dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
     ```

     and installing Ubuntu from the [Microsoft Store](https://aka.ms/wslstore).
   </Note>

2. Restart your computer when prompted.

3. After reboot, launch Ubuntu from the Start menu.
   On the first launch, create a UNIX username and password when prompted.

4. Open the Ubuntu terminal and run:

   ```bash  theme={null}
   sudo apt update
   sudo apt install -y curl git build-essential
   ```

### Installing Homebrew

1. Run the Homebrew install script:

   ```bash  theme={null}
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. Add Homebrew to your shell environment:

   ```bash  theme={null}
   echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> ~/.profile
   source ~/.profile
   ```

3. Verify that Homebrew was installed correctly:

   ```bash  theme={null}
   brew --version
   ```

### Installing `asdf`

<Info>
  Using `asdf` allows you to easily switch between versions of Scarb, Starknet Foundry, and Starknet Devnet globally or per project.
</Info>

1. Install `asdf` using Homebrew:

   ```bash  theme={null}
   brew install asdf
   ```

2. Add `asdf` to your shell:

   ```bash  theme={null}
   echo '. "$(brew --prefix asdf)/libexec/asdf.sh"' >> ~/.bashrc
   source ~/.bashrc
   ```

3. Verify that `asdf` is installed correctly:

   ```bash  theme={null}
   asdf --version
   ```

### Installing Scarb, Starknet Foundry, and Starknet Devnet

1. Add the Scarb plugin and install the latest Scarb version:

   ```bash  theme={null}
   asdf plugin add scarb
   asdf install scarb latest
   asdf set -u scarb latest
   ```

2. Add the Starknet Foundry plugin and install the latest Starknet Foundry version:

   ```bash  theme={null}
   asdf plugin add starknet-foundry
   asdf install starknet-foundry latest
   asdf set -u starknet-foundry latest
   ```

3. Add the Starknet Devnet plugin and install the latest Starknet Devnet version:

   ```bash  theme={null}
   asdf plugin add starknet-devnet
   asdf install starknet-devnet latest
   asdf set -u starknet-devnet latest
   ```

4. Restart your terminal and verify that Scarb, Starknet Foundry, and Starknet Devnet were installed correctly:

   ```bash  theme={null}
   scarb --version
   snforge --version && sncast --version
   starknet-devnet --version
   ```

   <Note>
     If `scarb`, `snforge`, or `starknet-devnet` are not recognized, try running `source ~/.bashrc` or restarting your terminal.
   </Note>

## Fetching a predeployed Sepolia account

**Procedure:**

1. Export the private key from your wallet by:
   * For Ready wallets: navigating to `Settings` -> `<YOUR_ACCOUNT>` -> `Export Private Key`.
   * For Braavos wallets: navigating to `Settings` -> `Privacy and Security` -> `Export Private Key`.

2. Create a keystore file by running:

```terminal  theme={null}
starkli signer keystore from-key keystore.json
```

and entering the private key of your smart wallet, along with a password that will be used to encrypt it.

3. Fetch the account by running:

```terminal  theme={null}
starkli account fetch \
    <SMART_WALLET_ADDRESS> \
    --output account.json \
    --network=sepolia
```

## Troubleshooting

### Starkli unable to detect shell

**Procedure:**

1. Detect whether your shell is `zsh` or `bash`:

```terminal  theme={null}
echo $SHELL
```

2. Add:

```terminal  theme={null}
. /Users/<NAME>/.starkli/env
```

to either `~/.zshrc` or `~/.bashrc`.

3. Restart the terminal, and run either:

```terminal  theme={null}
source ~/.zshrc
```

or:

```terminal  theme={null}
source ~/.bashrc
```

### `scarb build` fails to run version command for Rust

Starting from Scarb version 2.10 and Starknet Foundry version 0.37.0, Rust is longer required for projects with the following line in their `Scarb.toml` file:

```cairo  theme={null}
[tool.scarb]
allow-prebuilt-plugins = ["snforge_std"]
```

If not all three conditions are met and Rust is not installed, running `scarb build` (and `scarb test`) will result in a compilation error. To resolve this, either update Scarb, Starknet Foundry, and your `Scarb.toml` file accordingly or [install Rust](https://www.rust-lang.org/tools/install).

### `starkli declare` unable to identify compiler version

When using `starkli declare`, Starkli will do its best to identify the compiler version of the declared class. In case it fails, the `--compiler-version` flag can be used to specify the version of the compiler.

**Procedure:**

1. Find the compiler versions supported by Starkli by running:

```terminal  theme={null}
starkli declare --help 
```

and looking for the possible values of the `--compiler-version` flag.

2. Find the current Scarb version in use:

```terminal  theme={null}
scarb --version
```

3. In case a different compiler version is required, switch to a different Scarb version using `asdf`:

   a. Install the desired Scarb version:

   ```terminal  theme={null}
   asdf install scarb <VERSION>
   ```

   b. Select the desired Scarb version as the local version for the project:

   ```terminal  theme={null}
   asdf set scarb <VERSION>
   ```
