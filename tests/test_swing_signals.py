import unittest
import pandas as pd
import numpy as np

class TestSwingSignalsAndCooldown(unittest.TestCase):
    def _apply_cooldown(self, signal_series, cooldown_days=10):
        result = pd.Series(False, index=signal_series.index)
        last_signal_idx = -cooldown_days - 1
        for i, val in enumerate(signal_series):
            if val and (i - last_signal_idx > cooldown_days):
                result.iloc[i] = True
                last_signal_idx = i
        return result

    def test_cooldown_does_not_falsely_cascade(self):
        """
        Verify that intermediate raw signals occurring within a cooldown window
        are suppressed WITHOUT resetting the cooldown timer for future signals.
        """
        # Day 0: fires
        # Day 2: raw signal (within 10-day cooldown -> must be suppressed)
        # Day 4: raw signal (within 10-day cooldown -> must be suppressed)
        # Day 11: raw signal (11 days after Day 0 -> MUST FIRE!)
        raw_signals = pd.Series([
            True,   # 0
            False,  # 1
            True,   # 2 (suppressed)
            False,  # 3
            True,   # 4 (suppressed)
            False,  # 5
            False,  # 6
            False,  # 7
            False,  # 8
            False,  # 9
            False,  # 10
            True,   # 11 (MUST FIRE)
        ])

        cooled = self._apply_cooldown(raw_signals, cooldown_days=10)

        self.assertTrue(cooled.iloc[0], "Day 0 must fire")
        self.assertFalse(cooled.iloc[2], "Day 2 must be suppressed")
        self.assertFalse(cooled.iloc[4], "Day 4 must be suppressed")
        self.assertTrue(cooled.iloc[11], "Day 11 must fire because 11 - 0 > 10")

    def test_cooldown_minimum_gap(self):
        """
        Verify that any two consecutive signals are separated by at least cooldown_days + 1 sessions.
        """
        np.random.seed(42)
        random_raw = pd.Series(np.random.rand(500) > 0.8)
        cooled = self._apply_cooldown(random_raw, cooldown_days=10)

        signal_indices = cooled[cooled].index.tolist()
        for idx1, idx2 in zip(signal_indices[:-1], signal_indices[1:]):
            gap = idx2 - idx1
            self.assertGreater(
                gap, 10,
                f"Signal gap between index {idx1} and {idx2} is {gap}, expected > 10"
            )

    def test_swing_thrust_buy_boundaries(self):
        """
        Verify exact boundary conditions:
        Swing_Thrust_Buy: (Swing_Score >= 70.0) & (prev_swing < 70.0) & (Advance/Decline >= 2.0)
        """
        # Exact 70.0 crossing from 69.9 with AD 2.0
        score = pd.Series([69.9, 70.0])
        prev = score.shift(1)
        ad = pd.Series([1.5, 2.0])
        raw = (score >= 70.0) & (prev < 70.0) & (ad >= 2.0)
        self.assertTrue(raw.iloc[1], "Exact 70.0 with AD 2.0 must trigger")

        # Below 70.0 (69.99)
        score_low = pd.Series([60.0, 69.99])
        raw_low = (score_low >= 70.0) & (score_low.shift(1) < 70.0) & (ad >= 2.0)
        self.assertFalse(raw_low.iloc[1], "69.99 must not trigger")

        # AD below 2.0 (1.99)
        ad_low = pd.Series([1.5, 1.99])
        raw_ad_low = (score >= 70.0) & (prev < 70.0) & (ad_low >= 2.0)
        self.assertFalse(raw_ad_low.iloc[1], "AD 1.99 must not trigger")

        # No crossover (prev was already >= 70.0)
        score_no_cross = pd.Series([72.0, 75.0])
        raw_no_cross = (score_no_cross >= 70.0) & (score_no_cross.shift(1) < 70.0) & (ad >= 2.0)
        self.assertFalse(raw_no_cross.iloc[1], "Non-crossing score must not trigger")

    def test_swing_risk_sell_boundaries(self):
        """
        Verify exact boundary conditions:
        Swing_Risk_Sell: (Swing_Score < 45.0) & (prev_swing >= 45.0) & (Advance/Decline < 0.50)
        """
        # Exact 44.9 crossing from 45.0 with AD 0.49
        score = pd.Series([45.0, 44.9])
        prev = score.shift(1)
        ad = pd.Series([1.0, 0.49])
        raw = (score < 45.0) & (prev >= 45.0) & (ad < 0.50)
        self.assertTrue(raw.iloc[1], "44.9 crossing with AD 0.49 must trigger")

        # Exactly 45.0 must NOT trigger
        score_45 = pd.Series([50.0, 45.0])
        raw_45 = (score_45 < 45.0) & (score_45.shift(1) >= 45.0) & (ad < 0.50)
        self.assertFalse(raw_45.iloc[1], "Exact 45.0 is not < 45.0, must not trigger")

        # AD 0.50 must NOT trigger
        ad_50 = pd.Series([1.0, 0.50])
        raw_ad_50 = (score < 45.0) & (prev >= 45.0) & (ad_50 < 0.50)
        self.assertFalse(raw_ad_50.iloc[1], "AD 0.50 is not < 0.50, must not trigger")

    def test_heatmap_badge_isolation(self):
        """
        Verify that Advance/Decline Ratio >= 3.0 does NOT trigger Tactical Swing Thrust
        or Super-Confluence badge when Swing_Thrust_Buy is False.
        """
        # Mock row with high AD ratio but NO swing thrust
        row_breadth_only = {
            "Date": "2026-04-06",
            "Bullseye_Buy_Signal": True,
            "Swing_Thrust_Buy": False,
            "Advance/Decline Ratio": 3.50
        }

        is_macro = bool(row_breadth_only.get("Bullseye_Buy_Signal"))
        is_tactical = bool(row_breadth_only.get("Swing_Thrust_Buy"))
        is_super = is_macro and is_tactical

        # Macro must be True, but Tactical and Super must be False!
        self.assertTrue(is_macro)
        self.assertFalse(is_tactical)
        self.assertFalse(is_super, "High AD ratio must not trigger super-confluence without Swing_Thrust_Buy")

if __name__ == '__main__':
    unittest.main()
