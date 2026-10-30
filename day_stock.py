import os
import yfinance as yf
import psycopg2

conn = psycopg2.connect(
    host=os.getenv("DB_HOST", "localhost"),
    database=os.getenv("DB_NAME", "postgres"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD"),
    port=os.getenv("DB_PORT", "5432")
)

cursor = conn.cursor()

symbols = ["MSFT", "GOOGL", "AMZN"]

for symbol in symbols:
    data = yf.download(
        tickers=symbol,
        period="2mo",
        interval="1d",
        auto_adjust=False,
        progress=False
    )

    if data.empty:
        print(f"No data found for {symbol}")
        continue

    if isinstance(data.columns[0], tuple):
        data.columns = [col[0].lower() for col in data.columns]
    else:
        data.columns = [col.lower() for col in data.columns]

    for index, row in data.iterrows():
        query = """
        INSERT INTO public.stock_daily (symbol, date, open, high, low, close, volume)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (symbol, date) DO NOTHING;
        """

        cursor.execute(query, (
            symbol,
            index.date(),
            float(row["open"]),
            float(row["high"]),
            float(row["low"]),
            float(row["close"]),
            int(row["volume"])
        ))

conn.commit()
cursor.close()
conn.close()

print("Daily OHLCV data inserted successfully!")