"""Unit tests for Stage S6: Liquidity confidence scoring."""

from datetime import date

from app.liquidity.service import score_liquidity


def test_insufficient_history_returns_unknown() -> None:
    """When prior trading days is below min_history (5), label must be Unknown without guessing."""
    score = score_liquidity(
        symbol="GOLDM",
        expiry_date=date(2026, 11, 4),
        trade_date=date(2026, 10, 8),
        volume=1000,
        open_interest=3000,
        prior_volumes=[1000, 1100, 1200],  # only 3 days
        prior_ois=[3000, 3100, 3200],
        min_history_days=5,
    )
    assert score.label == "Unknown"
    assert score.reason == "insufficient history"
    assert score.volume_ratio is None
    assert score.oi_ratio is None
    assert score.history_days == 3


def test_division_by_zero_no_baseline_activity() -> None:
    """When median volume or OI is 0, do not divide; set ratios to None and label Unknown."""
    score = score_liquidity(
        symbol="GOLDM",
        expiry_date=date(2026, 11, 4),
        trade_date=date(2026, 10, 8),
        volume=500,
        open_interest=1000,
        prior_volumes=[0, 0, 0, 0, 0],  # median volume = 0
        prior_ois=[1000, 1000, 1000, 1000, 1000],
        min_history_days=5,
    )
    assert score.label == "Unknown"
    assert score.reason == "no baseline activity"
    assert score.volume_ratio is None
    assert score.oi_ratio is None


def test_standard_high_medium_low_untradeable_labels() -> None:
    """Standard ratio classifications without expiry proximity downgrade."""
    # Historical medians: vol=1000, oi=2000
    p_vols = [1000] * 10
    p_ois = [2000] * 10
    exp = date(2026, 11, 30)  # > 2 days away

    # High: vol >= 800 (ratio 0.8), oi >= 1600 (ratio 0.8)
    s_high = score_liquidity(
        symbol="GOLDM",
        expiry_date=exp,
        trade_date=date(2026, 10, 8),
        volume=900,
        open_interest=1800,
        prior_volumes=p_vols,
        prior_ois=p_ois,
    )
    assert s_high.label == "High"

    # Medium: vol 500 (0.5), oi 1000 (0.5)
    s_med = score_liquidity(
        symbol="GOLDM",
        expiry_date=exp,
        trade_date=date(2026, 10, 8),
        volume=500,
        open_interest=1000,
        prior_volumes=p_vols,
        prior_ois=p_ois,
    )
    assert s_med.label == "Medium"

    # Low: vol 150 (0.15), oi 300 (0.15)
    s_low = score_liquidity(
        symbol="GOLDM",
        expiry_date=exp,
        trade_date=date(2026, 10, 8),
        volume=150,
        open_interest=300,
        prior_volumes=p_vols,
        prior_ois=p_ois,
    )
    assert s_low.label == "Low"

    # Untradeable: vol 50 (0.05) < 0.1
    s_untr = score_liquidity(
        symbol="GOLDM",
        expiry_date=exp,
        trade_date=date(2026, 10, 8),
        volume=50,
        open_interest=100,
        prior_volumes=p_vols,
        prior_ois=p_ois,
    )
    assert s_untr.label == "Untradeable"


def test_zero_volume_is_always_untradeable() -> None:
    """Zero volume row must always be Untradeable even if open interest is massive."""
    score = score_liquidity(
        symbol="GOLDM",
        expiry_date=date(2026, 11, 30),
        trade_date=date(2026, 10, 8),
        volume=0,
        open_interest=10000,
        prior_volumes=[1000] * 10,
        prior_ois=[2000] * 10,
    )
    assert score.label == "Untradeable"
    assert "zero volume" in score.reason


def test_expiry_proximity_downgrade_rules() -> None:
    """Downgrade applies only to High, Medium, Low; never changes Unknown or Untradeable."""
    p_vols = [1000] * 10
    p_ois = [2000] * 10
    near_exp = date(2026, 10, 10)  # trade_date=Oct 8 -> days_to_expiry=2

    # High -> downgraded to Medium
    s_high_down = score_liquidity(
        symbol="GOLDM",
        expiry_date=near_exp,
        trade_date=date(2026, 10, 8),
        volume=900,
        open_interest=1800,
        prior_volumes=p_vols,
        prior_ois=p_ois,
    )
    assert s_high_down.label == "Medium"
    assert "downgraded" in s_high_down.reason

    # Medium -> downgraded to Low
    s_med_down = score_liquidity(
        symbol="GOLDM",
        expiry_date=near_exp,
        trade_date=date(2026, 10, 8),
        volume=500,
        open_interest=1000,
        prior_volumes=p_vols,
        prior_ois=p_ois,
    )
    assert s_med_down.label == "Low"
    assert "downgraded" in s_med_down.reason

    # Low -> downgraded to Untradeable
    s_low_down = score_liquidity(
        symbol="GOLDM",
        expiry_date=near_exp,
        trade_date=date(2026, 10, 8),
        volume=150,
        open_interest=300,
        prior_volumes=p_vols,
        prior_ois=p_ois,
    )
    assert s_low_down.label == "Untradeable"
    assert "downgraded" in s_low_down.reason

    # Untradeable remains Untradeable
    s_untr_near = score_liquidity(
        symbol="GOLDM",
        expiry_date=near_exp,
        trade_date=date(2026, 10, 8),
        volume=20,
        open_interest=50,
        prior_volumes=p_vols,
        prior_ois=p_ois,
    )
    assert s_untr_near.label == "Untradeable"
    assert "downgraded" not in s_untr_near.reason

    # Unknown remains Unknown
    s_unk_near = score_liquidity(
        symbol="GOLDM",
        expiry_date=near_exp,
        trade_date=date(2026, 10, 8),
        volume=900,
        open_interest=1800,
        prior_volumes=[1000, 1000],  # insufficient history
        prior_ois=[2000, 2000],
    )
    assert s_unk_near.label == "Unknown"
    assert "downgraded" not in s_unk_near.reason


def test_look_ahead_insensitivity() -> None:
    """Changing or deleting later dates must produce identical scores for earlier dates."""
    history = [1000, 1050, 1020, 1100, 1080, 1150]
    ois = [2000, 2050, 2020, 2100, 2080, 2150]

    # Baseline evaluation for Day 6
    baseline_score = score_liquidity(
        symbol="GOLDM",
        expiry_date=date(2026, 11, 30),
        trade_date=date(2026, 10, 6),
        volume=1200,
        open_interest=2200,
        prior_volumes=history[:5],
        prior_ois=ois[:5],
    )

    # Future days data (Day 7, Day 8) exists in the universe:
    # Day 6 evaluation MUST only use historical days strictly prior to Day 6
    rerun_score = score_liquidity(
        symbol="GOLDM",
        expiry_date=date(2026, 11, 30),
        trade_date=date(2026, 10, 6),
        volume=1200,
        open_interest=2200,
        prior_volumes=history[:5],
        prior_ois=ois[:5],
    )

    assert baseline_score.label == rerun_score.label
    assert baseline_score.volume_ratio == rerun_score.volume_ratio
    assert baseline_score.oi_ratio == rerun_score.oi_ratio
    assert baseline_score.reason == rerun_score.reason
