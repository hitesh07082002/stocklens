from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable

from django.utils import timezone

from apps.stocks.models import StockCache


FetchCallable = Callable[[], Any]


@dataclass(frozen=True)
class CacheFetchResult:
    data: Any
    cache_hit: bool
    fetched_at: datetime


def get_or_fetch_with_meta(
    symbol: str,
    endpoint: str,
    params: dict[str, Any],
    ttl_hours: int,
    fetch_fn: FetchCallable,
) -> CacheFetchResult:
    canonical_params = dict(params)
    params_hash = StockCache.make_params_hash(canonical_params)
    cache_entry = StockCache.objects.filter(
        symbol=symbol,
        endpoint=endpoint,
        params_hash=params_hash,
        expires_at__gt=timezone.now(),
    ).first()
    if cache_entry:
        return CacheFetchResult(
            data=cache_entry.response_data,
            cache_hit=True,
            fetched_at=cache_entry.fetched_at,
        )

    data = fetch_fn()
    cache_entry, _ = StockCache.objects.update_or_create(
        symbol=symbol,
        endpoint=endpoint,
        params_hash=params_hash,
        defaults={
            "params": canonical_params,
            "response_data": data,
            "expires_at": timezone.now() + timedelta(hours=ttl_hours),
        },
    )
    return CacheFetchResult(
        data=cache_entry.response_data,
        cache_hit=False,
        fetched_at=cache_entry.fetched_at,
    )


def get_or_fetch(symbol: str, endpoint: str, params: dict[str, Any], ttl_hours: int, fetch_fn: FetchCallable) -> Any:
    return get_or_fetch_with_meta(symbol, endpoint, params, ttl_hours, fetch_fn).data
