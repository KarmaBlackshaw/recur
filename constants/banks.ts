import BdoLogo from "@/assets/banks/bdo.svg";
import BpiLogo from "@/assets/banks/bpi.svg";
import MetrobankLogo from "@/assets/banks/metrobank.svg";
import UnionbankLogo from "@/assets/banks/unionbank.svg";
import SecuritybankLogo from "@/assets/banks/securitybank.svg";
import RcbcLogo from "@/assets/banks/rcbc.svg";
import EastwestLogo from "@/assets/banks/eastwest.svg";
import ChinabankLogo from "@/assets/banks/chinabank.svg";
import LandbankLogo from "@/assets/banks/landbank.svg";
import PnbLogo from "@/assets/banks/pnb.svg";
import GcashLogo from "@/assets/banks/gcash.svg";
import MayaLogo from "@/assets/banks/maya.svg";
import MaribankLogo from "@/assets/banks/maribank.svg";
import GotymeLogo from "@/assets/banks/gotyme.svg";

export const BANKS = [
  { id: "bdo", name: "BDO", color: "#0B2972", Logo: BdoLogo },
  { id: "bpi", name: "BPI", color: "#B11116", Logo: BpiLogo },
  { id: "metrobank", name: "Metrobank", color: "#023184", Logo: MetrobankLogo },
  { id: "unionbank", name: "UnionBank", color: "#FA4913", Logo: UnionbankLogo },
  { id: "securitybank", name: "Security Bank", color: "#0168B3", Logo: SecuritybankLogo },
  { id: "rcbc", name: "RCBC", color: "#4892CF", Logo: RcbcLogo },
  { id: "eastwest", name: "EastWest", color: "#591A7C", Logo: EastwestLogo },
  { id: "chinabank", name: "China Bank", color: "#ED1A37", Logo: ChinabankLogo },
  { id: "landbank", name: "Landbank", color: "#74BC44", Logo: LandbankLogo },
  { id: "pnb", name: "PNB", color: "#10357F", Logo: PnbLogo },
  { id: "gcash", name: "GCash", color: "#007CFF", Logo: GcashLogo },
  { id: "maya", name: "Maya", color: "#000000", Logo: MayaLogo },
  { id: "maribank", name: "MariBank", color: "#EA5F01", Logo: MaribankLogo },
  { id: "gotyme", name: "GoTyme", color: "#2D2D3A", Logo: GotymeLogo },
] as const;

export type BankId = (typeof BANKS)[number]["id"];

export function findBank(id: BankId | null) {
  return BANKS.find((bank) => bank.id === id);
}
