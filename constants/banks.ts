import BdoLogo from "@/assets/banks/bdo.png";
import BpiLogo from "@/assets/banks/bpi.png";
import MetrobankLogo from "@/assets/banks/metrobank.png";
import UnionbankLogo from "@/assets/banks/unionbank.png";
import SecuritybankLogo from "@/assets/banks/securitybank.png";
import RcbcLogo from "@/assets/banks/rcbc.png";
import EastwestLogo from "@/assets/banks/eastwest.png";
import ChinabankLogo from "@/assets/banks/chinabank.png";
import LandbankLogo from "@/assets/banks/landbank.png";
import PnbLogo from "@/assets/banks/pnb.png";
import GcashLogo from "@/assets/banks/gcash.png";
import MayaLogo from "@/assets/banks/maya.png";
import MaribankLogo from "@/assets/banks/maribank.png";
import GotymeLogo from "@/assets/banks/gotyme.png";

export const BANKS = [
  { id: "bdo", name: "BDO", color: "#0B2972", logo: BdoLogo },
  { id: "bpi", name: "BPI", color: "#B11116", logo: BpiLogo },
  { id: "metrobank", name: "Metrobank", color: "#023184", logo: MetrobankLogo },
  { id: "unionbank", name: "UnionBank", color: "#FA4913", logo: UnionbankLogo },
  { id: "securitybank", name: "Security Bank", color: "#0168B3", logo: SecuritybankLogo },
  { id: "rcbc", name: "RCBC", color: "#4892CF", logo: RcbcLogo },
  { id: "eastwest", name: "EastWest", color: "#591A7C", logo: EastwestLogo },
  { id: "chinabank", name: "China Bank", color: "#ED1A37", logo: ChinabankLogo },
  { id: "landbank", name: "Landbank", color: "#74BC44", logo: LandbankLogo },
  { id: "pnb", name: "PNB", color: "#10357F", logo: PnbLogo },
  { id: "gcash", name: "GCash", color: "#007CFF", logo: GcashLogo },
  { id: "maya", name: "Maya", color: "#000000", logo: MayaLogo },
  { id: "maribank", name: "MariBank", color: "#EA5F01", logo: MaribankLogo },
  { id: "gotyme", name: "GoTyme", color: "#2D2D3A", logo: GotymeLogo },
] as const;

export type BankId = (typeof BANKS)[number]["id"];

export function findBank(id: BankId | null) {
  return BANKS.find((bank) => bank.id === id);
}
