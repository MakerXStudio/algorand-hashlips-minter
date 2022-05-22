# Algorand HashLips NFT Minter

This project lets you take the output of [HashLips](https://github.com/HashLips/hashlips_art_engine) and mint it on Algorand as [ARC-69](https://arc69.com/) [Algorand Standard Assets](https://developer.algorand.org/docs/get-details/asa/), including uploading asset images to IPFS using [Web3.Storage](https://web3.storage/).

The script in this project will mint against a local emulator by default, but the config can change to point to TestNet and MainNet. Once you mint against MainNet you can check out your collection at [NFT Explorer](https://www.nftexplorer.app/).

**Note:** In order to mint, you need to hold a minimum balance in the minting account of 0.1 ALGO per each asset minted (+ 0.1 ALGOs as the minium balance to have an active account) and each minting transaction will cost 0.001 ALGOs. So if you have 1000 NFTs your minting account will need to have at least 110.100 ALGOs.

# Developer setup

## First time setup

### (Optional) If you want to mint against a local Algorand emulator (recommended)

We recommend you first execute this against a locally running Algorand sandbox node so that you can check the minting works OK before running against MainNet.

1. Ensure you have Docker Engine and/or Docker Desktop installed
2. Make sure that you have [Powershell Core (7+)](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell?view=powershell-7.2) installed

   - Windows: `choco install pwsh -y`
   - MacOS: `brew install --cask powershell`

3. Clone the repository
4. Run `reset.ps1` if you want to reset your environment or `setup.ps1` to setup environment for the first time

   - If you want to re-start the environment after say restarting your machine or pulling latest changes you can run `update.ps1`

### Regardless of whether minting against local Algorand emulator or not

1. Open in VS Code (or your IDE of choice, although you'll get a better developer experience in VS Code since there are run and debug configurations and settings specified)
2. Install recommended extensions
3. Inside `minter`:

   - Copy `.env.sample` to `.env` and fill in the relevant variables, including Web3.Storage token and, depending on whether you want to test against either the local sandbox or Algorand TestNet, the Algorand node config (e.g. via [AlgoNode](https://algonode.io/api/) or via [PureStake](https://purestake.io/), for which you would need to [create an account](https://developer.purestake.io/signup))
   - Run `npm install`

4. Add the metadata for your particular NFT project in `minter/index.ts`

5. (If using VS Code) Choose the thing you want to run/debug from the "Run and Debug" pane (ctrl+shift+D on Windows) and hit F5 and it will launch it with breakpoint debugging

6. OR (If not using VS Code) run `npm run dev` in the `minter` folder

## Ongoing development

There are a number of commandline scripts that you can use to ease local development:

- `reset.ps1` - Reset and recreates your environment including docker containers, npm installs, python installs, etc.
- `status.ps` - Outputs the current status of the dependent docker container services (Reach Algorand sandbox and localstack)
- `update.ps1` - Ensures the docker containers and npm installs are up to date, useful to run this after pull code changes or computer restart etc.
- `goal.ps1` - This is a proxy to running the goal [Algorand Command Line Interface (CLI)](https://developer.algorand.org/docs/clis/goal/goal/) within the `algod` container

# Components

This repository contains the following components:

- **Learning**

  - **[Learning paths](docs/learning-paths/README.md)** - We have developed a number of learning paths to help people quickly get up to speed with the various concepts to understand and develop for this solution.

- **Local development**

  - **[Algorand Sandbox](docker-compose.yml)** - A locally running instance of [Algorand Sandbox](https://github.com/algorand/sandbox) in `dev` configuration [via our customised Docker builds](https://github.com/MakerXStudio/algorand-sandbox-dev) - this is automatically started via the [setup.ps1](setup.ps1) (which in turn calls `docker-compose up -d`)

    - You can interrogate the sandbox via the `./goal.ps1` and `./status.ps1` scripts in the project root once it's running
    - Useful commands:

      ```
      # Check current status
      ./status.ps1
      # See commandline options for goal (Algorand CLI): https://developer.algorand.org/docs/clis/goal/goal/
      ./goal.ps1
      # See global state of app with index 1
      ./goal.ps1 app read --app-id 1 --global
      # See high level info of app with index 1
      ./goal.ps1 app info --app-id 1
      # Dump out the balance of ALGOs and assets for account with address {addr}
      ./goal.ps1 account dump -a {addr}
      ```

  - **[VS Code](.vscode)** - Extension recommendations, launch and task configuration and settings to set up a productive VS Code environment

- **App components**
  - **[NFT Minter](minter)** - TypeScript / Node.js app responsible for minting
