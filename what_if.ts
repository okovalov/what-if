import axios from 'axios';

interface CoinData {
  name: string;
  symbol: string;
  buyingPrice: number;
  ath: number;
  athDate: string;
  potentialEarningsAth: number;
  potentialChemoSession: number;
  athDropPercentage: number;
  currentPrice: number;
  currentValue: number;
  loss: number;
}

// the app is to small to extract it to the helpers
export const delay = (ms: number): Promise<void> => {
  const safeMs = Math.max(0, Number(ms) || 0);
  return new Promise((resolve) => setTimeout(resolve, safeMs));
};

// chemo cost in the states per month. using medium between 1-12k value
const CHEMO_COST_USA = 6_000;

const INVEST_AMOUNT = 1_000;
const NUMBER_OF_COINS_TO_PICK = 6;
const START_INVESTMENT_PRICE_PERCENT = 25;

// I want to avoid hitting the coingecko limits..
async function rateLimitedGet(url: string, config?: any): Promise<any> {
  console.log('- - - patiently waiting before calling coingecko free api, so we are not banned..');
  await delay(3000);
  console.log('- - - calling ', url);
  const response = await axios.get(url, config);
  await delay(3000);
  return response.data;
}

// just a helper function to show logical piece of functionality
async function getSolanaMemeCoins(): Promise<any[]> {
  const solanaCoins = await rateLimitedGet('https://api.coingecko.com/api/v3/coins/markets', {
    params: {
      vs_currency: 'usd',
      category: 'solana-ecosystem',
      per_page: 250,
      sparkline: false,
    },
  });

  console.log('\n');
  console.log("We got some meme coins. Let's filter ones what dropped the value the most.");
  console.log('\n');

  return solanaCoins.filter((coin: any) => {
    const res = coin.name.toLowerCase().includes('meme') || coin.symbol.toLowerCase().includes('meme');

    return res;
  });
}

// one more helper, to post-process data
async function processCoin(coin: any): Promise<CoinData | null> {
  try {
    console.log('....processing ', coin.symbol);

    await delay(3000);

    const history = await rateLimitedGet(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart`, {
      params: {
        vs_currency: 'usd',
        days: '365',
        interval: 'daily',
      },
    });

    await delay(3000);

    const prices = history?.prices;
    const [earliestPoint] = prices || [];
    const [_, earliestPrice] = earliestPoint || [];

    const ath = coin.ath;
    const buyingPriceToCheck = (ath * START_INVESTMENT_PRICE_PERCENT) / 100;
    const buyingPrice = earliestPrice && earliestPrice < buyingPriceToCheck ? earliestPrice : buyingPriceToCheck;

    const numberOfTokensToBuy = INVEST_AMOUNT / buyingPrice;
    const potentialEarningsAth = ath * numberOfTokensToBuy;
    const potentialChemoSession = potentialEarningsAth / CHEMO_COST_USA;

    const currentPrice = coin.currentPrice;
    const athDropPercentage = ((ath - currentPrice) / ath) * 100;

    const currentValue = currentPrice * numberOfTokensToBuy;
    const loss = currentValue > INVEST_AMOUNT ? 0 : currentValue - INVEST_AMOUNT;

    const res = {
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      buyingPrice,
      ath,
      athDate: coin.athDate,
      potentialEarningsAth,
      potentialChemoSession,
      athDropPercentage,
      currentPrice,
      currentValue: currentPrice * numberOfTokensToBuy,
      loss,
    };
    return res;
  } catch (error) {
    console.error(`Error processing ${coin.id}:`, error.message);
    return null;
  }
}

// sort of main entry point
async function main() {
  console.log(`\nHi there.`);
  await delay(3000);
  console.log("\nLet's take a look some biggest loosers among SOL meme coins.\n");
  await delay(3000);
  try {
    const memeCoins = await getSolanaMemeCoins();

    console.log('We have filtered memeCoins with >= 70% loss. Total of ' + memeCoins.length + ' coins.');
    console.log('\n');
    await delay(2000);

    const coinsWithBasicData: Array<any> = [];

    console.log(
      "Now, let's fetch some history data and process it. (Please wait, everything will be explained later).",
    );
    console.log('\n');
    await delay(10_000);

    for (const coin of memeCoins) {
      await delay(3000);
      const details = await rateLimitedGet(`https://api.coingecko.com/api/v3/coins/${coin.id}`);
      await delay(3000);
      coinsWithBasicData.push(details);
    }

    const filteredCoins = coinsWithBasicData
      .map((coin) => ({
        ath: coin.market_data.ath.usd,
        athDate: coin.market_data.ath_date.usd, // date
        currentPrice: coin.market_data.current_price.usd,
        athDropPercentage:
          ((coin.market_data.ath.usd - coin.market_data.current_price.usd) / coin.market_data.ath.usd) * 100,
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        contract_address: coin.platforms.solana,
      }))
      .filter((coin) => coin.athDropPercentage > 70)
      .sort((a, b) => b.athDropPercentage - a.athDropPercentage)
      .slice(0, NUMBER_OF_COINS_TO_PICK);

    const finalResults: CoinData[] = [];

    await delay(10_000);

    for (const coin of filteredCoins) {
      const processed = await processCoin(coin);
      if (processed) finalResults.push(processed);
    }

    console.log('\n\n\nNow imagine... ');
    await delay(5000);
    console.log('\n\n\nJust imagine... ');
    await delay(5000);
    console.log(`\n\nWhat if you would've invested $${INVEST_AMOUNT} into each of those tokens at some point?`);
    await delay(3000);
    console.log(`\n\nLet's say a year ago`);
    await delay(2000);

    console.log(`and you sold it when it was ATH or near that point.`);
    await delay(2000);

    console.log(`\n\nThat's what you would have gotten.`);
    await delay(2000);

    console.table(
      finalResults.map((coin) => ({
        Symbol: coin.symbol,
        'Your investment': `$${INVEST_AMOUNT.toLocaleString()}`,
        'Entry Price': `$${coin.buyingPrice}`,
        'ATH Price': `$${coin.ath}`,
        'ATH Date': new Date(coin.athDate).toLocaleDateString(),
        'Potential Earnings ATH': `$${coin.potentialEarningsAth.toFixed(2)}`,
        'Potential Chemo you could help with': `${coin.potentialChemoSession.toFixed(2)}`,
      })),
    );

    console.log(`\n\nBut you waited.`);
    await delay(2000);
    console.log(`\n\nOr you did not know..`);
    await delay(2000);
    console.log(`\n\nDoesn't matter....`);
    await delay(2000);
    console.log('\n\nTime matters... And now you got this.');

    await delay(2000);

    console.table(
      finalResults.map((coin) => ({
        Symbol: coin.symbol,
        'Your investment': `$${INVEST_AMOUNT.toLocaleString()}`,
        'ATH Price': `$${coin.ath}`,
        'ATH Drop %': `${coin.athDropPercentage.toFixed(2)}%`,
        'Current Price': `$${coin.currentPrice}`,
        'Current Value': `$${coin.currentValue.toFixed(2)}`,
        'Your loss': `${coin.loss === 0 ? `0.00` : +coin.loss.toFixed(2)}`,
      })),
    );

    await delay(10000);
    console.log("\n\nTime matters... So you do. Don't waste time or opportunity.");
    await delay(4000);
    console.log(`\n\nBye for now.`);
  } catch (error) {
    console.error('ops.. the programm failed:', error.message);
    process.exit(1);
  }
}

main();
