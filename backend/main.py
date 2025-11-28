from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import io
import csv
import yfinance as yf

app = FastAPI()

# Allow your React frontend to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Data model we send to the frontend ----------

class Position(BaseModel):
    ticker: str
    description: str
    quantity: float
    cost_basis: float
    avg_cost: float
    current_price: float
    market_value: float
    pnl: float


portfolio: List[Position] = []


def parse_number(s: str) -> float:
    """
    Handle things like '9,000', '$1,278.75', '--', '' safely.
    """
    if s is None:
        return 0.0
    s = str(s).strip()
    if s in ("", "--"):
        return 0.0
    s = s.replace("$", "").replace(",", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


# ---------- Basic endpoints ----------

@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/portfolio", response_model=List[Position])
def get_portfolio():
    return portfolio


# ---------- Upload your broker positions CSV ----------

@app.post("/api/upload-positions", response_model=List[Position])
async def upload_positions(file: UploadFile = File(...)):
    """
    Expects a CSV like your PositionsBrok11-28(Sheet 1 - Custodial Brokerage-P).csv:

        Symbol,Description,Qty (Quantity),Cost Basis
        AAPL,APPLE INC,32.9257,$1,278.75
        AMZN,AMAZON.COM INC,25,$3,183.54
        ...

    - We ignore extra rows automatically if quantity or cost basis are zero/blank.
    - We compute avg_cost = cost_basis / quantity.
    - We pull current_price from yfinance.
    """
    global portfolio
    portfolio = []

    content = await file.read()
    text = content.decode("utf-8")

    reader = csv.DictReader(io.StringIO(text))

    for row in reader:
        symbol_raw = (row.get("Symbol") or "").strip()
        if not symbol_raw:
            continue  # skip blank rows

        qty_str = row.get("Qty (Quantity)")
        cost_str = row.get("Cost Basis")
        desc = (row.get("Description") or "").strip()

        quantity = parse_number(qty_str)
        cost_basis = parse_number(cost_str)

        # skip rows that aren’t real positions
        if quantity <= 0 or cost_basis <= 0:
            continue

        ticker = symbol_raw.upper()
        avg_cost = cost_basis / quantity if quantity > 0 else 0.0

        # get current price from yfinance
        quote = yf.Ticker(ticker).history(period="1d")
        if quote.empty:
            current_price = avg_cost
        else:
            current_price = float(quote["Close"].iloc[-1])

        market_value = current_price * quantity
        pnl = market_value - cost_basis

        portfolio.append(
            Position(
                ticker=ticker,
                description=desc,
                quantity=quantity,
                cost_basis=cost_basis,
                avg_cost=avg_cost,
                current_price=current_price,
                market_value=market_value,
                pnl=pnl,
            )
        )

    return portfolio
