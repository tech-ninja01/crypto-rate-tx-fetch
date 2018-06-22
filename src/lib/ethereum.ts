import * as EthereumTx from "ethereumjs-tx";
import * as Web3 from "web3";
import abi from "../../contracts/erc20Abi";
import logger from "./logger";

const status = {
  NOT_REACHED: "NOT_REACHED",
  REVERTED: "FAILED",
  OUTOFGAS: "FAILED",
  SUCCESS: "SUCCESS",
  NOT_MINED: "NOT_MINED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  PENDING: "PENDING",
};

class Ethereum {
  public web3: Web3;
  public contract: any;
  public privateKeyBuffer: Buffer;
  public contractInstance: any;

  constructor() {
    this.web3 = new Web3(new Web3.providers.HttpProvider(process.env.BC_NODE_URL));
    this.contract = this.web3.eth.contract(abi);
    this.privateKeyBuffer = Buffer.from(process.env.PRIVATE_KEY, "hex");
    this.contractInstance = this.contract.at(process.env.SMART_CONTRACT_ADDRESS);
  }

  public async sendTransaction(toAddress: string, fromAddress: string, tokenCount: number) {
    const tokenData = await this.contractInstance.transfer.getData(toAddress, tokenCount);
    let gasprice = (await this.web3.eth.gasPrice.toString()) * 4;
    let nonce = await this.web3.eth.getTransactionCount(fromAddress);

    if (gasprice === 0) {
      gasprice = 9000000000;
    }

    const transactionParams = {
      from: fromAddress,
      nonce: this.web3.toHex(nonce++),
      gasPrice: this.web3.toHex(gasprice),
      gasLimit: this.web3.toHex(4000000),
      to: process.env.SMART_CONTRACT_ADDRESS,
      value: "0x0",
      data: tokenData,
      chainId: 3,
    };
    const transaction = new EthereumTx(transactionParams);
    transaction.sign(this.privateKeyBuffer);
    const serializedTransaction = transaction.serialize();

    try {
      const txHash = await this.web3.eth.sendRawTransaction(
        "0x" + serializedTransaction.toString("hex"),
      );
      return txHash;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async getWalletBalance(address: string) {
    try {
      const balance = await this.contractInstance.balanceOf.call(address);
      return balance.toString();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async getTransactionReceipt(txnHash: string) {
    try {
      const response = await this.web3.eth.getTransactionReceipt(txnHash);
      return response;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async getTransactionStatus(txHash: string) {
    try {
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      if (!receipt) {
        const transaction = await this.web3.eth.getTransaction(txHash);
        if (!transaction) {
          return status.NOT_REACHED;
        }
        return status.PENDING;
      }
      if (receipt.status === "0x0") {
        const transaction = await this.web3.eth.getTransaction(txHash);
        if (receipt.gasUsed === transaction.gas) {
          return status.OUTOFGAS;
        }
        return status.REVERTED;
      }
      return status.SUCCESS;
    } catch (error) {
      logger.error(error);
      return status.INTERNAL_SERVER_ERROR;
    }
  }
}

export default new Ethereum();
