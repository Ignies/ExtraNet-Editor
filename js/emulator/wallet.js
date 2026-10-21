// The emulator's bank account: what the card in the reader holds. In game the colony bank keeps it (ColonyBankSystem);
// here it is one local wallet in this browser, shared by everything on the ExtraNet that takes money: the
// sportsbook's bets and WeyBay's orders. Reset clears it.

const WALLET_KEY = 'extranet-emulator-wallet';
const START_BALANCE = 500;

/** The balance, whole dollars. A wallet never written starts at $500. */
export function readBalance() {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (raw === null) return START_BALANCE;
    const value = Number(raw);
    if (Number.isFinite(value)) return Math.floor(value);
    const parsed = JSON.parse(raw);
    const nested = Number(parsed?.balance ?? parsed?.credits);
    return Number.isFinite(nested) ? Math.floor(nested) : START_BALANCE;
  } catch {
    return START_BALANCE;
  }
}

export function writeBalance(value) {
  try {
    localStorage.setItem(WALLET_KEY, String(value));
  } catch {
    // the wallet lives for this page only
  }
}
