import { BigNumber } from "@ethersproject/bignumber";
import { t, Trans } from "@lingui/macro";
import { message } from "antd";
import { FC, useCallback, useEffect, useState } from "react";
import ChooseType from "../../components/ChooseType";
import { HoldLine } from "../../components/HoldLine";
import { PutDownIcon } from "../../components/Icon";
import InfoShow from "../../components/InfoShow";
import { LeverChoose } from "../../components/LeverChoose";
import MainButton from "../../components/MainButton";
import MainCard from "../../components/MainCard";
import PerpetualsList from "../../components/PerpetualsList";
import { DoubleTokenShow, SingleTokenShow } from "../../components/TokenShow";
import { useFortLeverBuy } from "../../contracts/hooks/useFortLeverTransation";
import { FortLeverContract, tokenList } from "../../libs/constants/addresses";
import {
  ERC20Contract,
  FortLever,
  NestPriceContract,
} from "../../libs/hooks/useContract";
import useTransactionListCon, {
  TransactionType,
} from "../../libs/hooks/useTransactionInfo";
import useWeb3 from "../../libs/hooks/useWeb3";
import {
  bigNumberToNormal,
  formatInputNum,
  normalToBigNumber,
} from "../../libs/utils";
import "./styles";

export type LeverListType = {
  index: BigNumber; //  编号
  tokenAddress: string; //  token地址
  lever: BigNumber; //  X倍数
  orientation: boolean; //  涨跌
  balance: BigNumber; //  保证金
  price: BigNumber; //  基础价格
  settleBlock: BigNumber; //  基础区块号
};

const Perpetuals: FC = () => {
  const { account, chainId } = useWeb3();
  const [isLong, setIsLong] = useState(true);
  const [dcuBalance, setDcuBalance] = useState<BigNumber>();
  const [nowPrice, setNowPrice] = useState<BigNumber>();
  const [leverNum, setLeverNum] = useState<number>(1);
  const [dcuInput, setDcuInput] = useState<string>("");
  const [isRefresh, setIsRefresh] = useState<boolean>(false);
  const [leverListState, setLeverListState] = useState<Array<LeverListType>>(
    []
  );
  const classPrefix = "perpetuals";
  const dcuToken = ERC20Contract(tokenList["DCU"].addresses);
  const priceContract = NestPriceContract();
  const leverContract = FortLever(FortLeverContract);
  const { pendingList, txList } = useTransactionListCon();
  const handleType = (isLong: boolean) => {
    setIsLong(isLong);
  };
  const handleLeverNum = (selected: number) => {
    setLeverNum(selected);
  };
  const trList = leverListState.map((item) => {
    return (
      <PerpetualsList
        className={classPrefix}
        item={item}
        key={item.index.toString() + account}
      />
    );
  });
  // price
  useEffect(() => {
    if (!priceContract || !chainId) {
      return;
    }
    (async () => {
      const price = await priceContract.latestPrice(
        tokenList["USDT"].addresses[chainId]
      );
      setNowPrice(price[1]);
    })();
  }, [chainId, priceContract]);
  // balance
  useEffect(() => {
    if (!dcuToken) {
      return;
    }
    (async () => {
      const balance = await dcuToken.balanceOf(account);
      setDcuBalance(balance);
    })();
  }, [dcuToken, account]);
  // list
  const getList = useCallback(async () => {
    if (!leverContract || !account) {
      return;
    }
    const leverList = await leverContract.find("0", "13", "13", account);
    const resultList = leverList.filter((item: LeverListType) =>
      item.balance.gt(BigNumber.from("0"))
    );
    setLeverListState(resultList);
    setIsRefresh(true);
  }, [account, leverContract]);
  useEffect(() => {
    if (!txList || txList.length === 0) {
      return;
    }
    const latestTx = txList[txList.length - 1];
    if (
      latestTx.txState === 1 &&
      (latestTx.type === 0 || latestTx.type === 1)
    ) {
      setTimeout(getList, isRefresh ? 4000 : 0);
    } else if (!isRefresh) {
      getList();
    }
  }, [getList, isRefresh, txList]);
  const checkDCUBalance = normalToBigNumber(dcuInput).gt(
    dcuBalance || BigNumber.from("0")
  );
  const mainButtonState = () => {
    const pendingTransaction = pendingList.filter(
      (item) => item.type === TransactionType.buyLever
    );
    return pendingTransaction.length > 0 ? true : false;
  };
  const checkMainButton = () => {
    if (
      dcuInput === "" ||
      normalToBigNumber(dcuInput).eq(BigNumber.from("0")) ||
      checkDCUBalance ||
      mainButtonState()
    ) {
      return false;
    }
    return true;
  };
  const active = useFortLeverBuy(
    "ETH",
    leverNum,
    isLong,
    normalToBigNumber(dcuInput)
  );
  return (
    <div>
      <MainCard classNames={`${classPrefix}-card`}>
        <InfoShow topLeftText={t`Token pair`} bottomRightText={""}>
          <div className={`${classPrefix}-card-tokenPair`}>
            <DoubleTokenShow tokenNameOne={"ETH"} tokenNameTwo={"USDT"} />
            <button className={"select-button"}>
              <PutDownIcon />
            </button>
          </div>
          <p>
            1 ETH ={" "}
            {bigNumberToNormal(
              nowPrice || BigNumber.from("0"),
              tokenList["USDT"].decimals,
              6
            )}{" "}
            USDT
          </p>
        </InfoShow>
        <ChooseType callBack={handleType} isLong={isLong} />
        <LeverChoose selected={leverNum} callBack={handleLeverNum} />
        <InfoShow
          topLeftText={t`Mint amount`}
          bottomRightText={`Balance: ${
            dcuBalance ? bigNumberToNormal(dcuBalance) : "----"
          } DCU`}
          balanceRed={checkDCUBalance}
        >
          <SingleTokenShow tokenNameOne={"DCU"} isBold />
          <input
            placeholder={t`Input`}
            className={"input-middle"}
            value={dcuInput}
            onChange={(e) => setDcuInput(formatInputNum(e.target.value))}
            onBlur={(e: any) => {}}
          />
          <button
            className={"max-button"}
            onClick={() =>
              setDcuInput(bigNumberToNormal(dcuBalance || BigNumber.from("0")))
            }
          >
            MAX
          </button>
        </InfoShow>
        <MainButton
          className={`${classPrefix}-card-button`}
          onClick={() => {
            if (!checkMainButton()) {
              return;
            }
            if (normalToBigNumber(dcuInput).lt(normalToBigNumber("100"))) {
              message.error(t`Minimum input 100`);
              return;
            }
            active();
          }}
          disable={!checkMainButton()}
          loading={mainButtonState()}
        >
          {isLong ? <Trans>Long</Trans> : <Trans>Short</Trans>}
        </MainButton>
      </MainCard>
      {leverListState.length > 0 ? (
        <div>
          <HoldLine>
            <Trans>Hold Options</Trans>
          </HoldLine>
          <table>
            <thead>
              <tr className={`${classPrefix}-table-title`}>
                <th>Token pair</th>
                <th>Options Type</th>
                <th>Leveraged Multiplier</th>
                <th>Guarantee</th>
                <th>Positioning</th>
                <th>Liquidation Price</th>
                <th>Current Yield</th>
                <th>Operation</th>
              </tr>
            </thead>
            <tbody>{trList}</tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

export default Perpetuals;
