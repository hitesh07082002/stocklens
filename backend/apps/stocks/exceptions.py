class StockNotFoundError(Exception):
    def __init__(self, symbol: str):
        self.symbol = symbol.upper()
        super().__init__(f"Stock '{self.symbol}' not found.")


class UpstreamServiceError(Exception):
    def __init__(self, message: str = "FMP API unreachable during synchronous cache-through fetch."):
        super().__init__(message)
