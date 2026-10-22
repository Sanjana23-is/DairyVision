import { FinancialImpact, CowWhatIfResponse } from "@/services/simulation";

export function getLocalizedFinancialExplanation(
  impact: FinancialImpact,
  t: (key: string, fallback?: string) => string
): string {
  const dFeed = Math.abs(impact.delta_feed_kg);
  const dMilk = Math.abs(impact.delta_milk_liters);
  const feedCost = Math.abs(impact.daily_feed_cost_change).toFixed(2);
  const rev = Math.abs(impact.daily_revenue_change).toFixed(2);
  const net = Math.abs(impact.daily_net_benefit).toFixed(2);
  const price = String(impact.milk_price_per_liter);

  const formatText = (template: string) => {
    return template
      .replace("{feed}", dFeed.toFixed(1))
      .replace("{feedCost}", feedCost)
      .replace("{milk}", dMilk.toFixed(1))
      .replace("{rev}", rev)
      .replace("{net}", net)
      .replace("{price}", price);
  };

  if (impact.delta_feed_kg > 0) {
    if (impact.delta_milk_liters > 0) {
      if (impact.daily_net_benefit > 1.0) {
        return formatText(
          t(
            "sim.explain.feed_milk_pos",
            "Adding {feed} kg of feed increases daily feed cost by ₹{feedCost}, but predicted milk yield increases by +{milk} L/day, generating +₹{rev} in additional revenue. The milk revenue exceeds the feed cost, yielding an estimated net benefit of +₹{net}/day."
          )
        );
      } else if (impact.daily_net_benefit < -1.0) {
        return formatText(
          t(
            "sim.explain.feed_milk_neg",
            "Adding {feed} kg of feed increases daily feed cost by ₹{feedCost}, but the model predicts only +{milk} L/day additional milk, worth +₹{rev}/day at ₹{price}/L. The additional feed cost exceeds the milk revenue, resulting in an estimated net impact of -₹{net}/day."
          )
        );
      } else {
        return formatText(
          t(
            "sim.explain.feed_milk_even",
            "Adding {feed} kg of feed costs +₹{feedCost}/day, which closely balances the predicted +{milk} L/day milk revenue (+₹{rev}/day), resulting in a near break-even impact."
          )
        );
      }
    } else if (impact.delta_milk_liters < 0) {
      return formatText(
        t(
          "sim.explain.feed_inc_milk_drop",
          "Increasing feed by {feed} kg adds +₹{feedCost}/day in feed cost, but predicted milk production falls by {milk} L/day (-₹{rev} revenue). The combined effect produces an estimated net impact of -₹{net}/day."
        )
      );
    } else {
      return formatText(
        t(
          "sim.explain.feed_inc_milk_same",
          "Increasing feed by {feed} kg adds +₹{feedCost}/day in feed cost, while predicted milk yield remains unchanged (₹0.00 revenue change). This results in a net daily cost of -₹{net}/day."
        )
      );
    }
  } else if (impact.delta_feed_kg === 0) {
    if (impact.delta_milk_liters > 0) {
      return formatText(
        t(
          "sim.explain.no_feed_milk_pos",
          "With feed intake unchanged (₹0.00 feed cost delta), environmental or cooling adjustments boost predicted milk yield by +{milk} L/day, producing a net financial gain of +₹{net}/day."
        )
      );
    } else if (impact.delta_milk_liters < 0) {
      return formatText(
        t(
          "sim.explain.no_feed_milk_neg",
          "With feed intake unchanged (₹0.00 feed cost delta), environmental stress reduces predicted milk production by {milk} L/day, producing an estimated revenue loss of -₹{net}/day."
        )
      );
    } else {
      return t(
        "sim.explain.no_change",
        "No change in feed intake or predicted milk yield results in a ₹0.00 net financial impact."
      );
    }
  } else {
    // delta_feed_kg < 0
    if (impact.delta_milk_liters >= 0) {
      return formatText(
        t(
          "sim.explain.feed_dec_milk_pos",
          "Reducing feed by {feed} kg saves ₹{feedCost}/day in feed cost while predicted milk yield changes by +{milk} L/day (+₹{rev}/day revenue), yielding a net financial benefit of +₹{net}/day."
        )
      );
    } else {
      if (impact.daily_net_benefit >= 0) {
        return formatText(
          t(
            "sim.explain.feed_dec_milk_neg_save",
            "Reducing feed by {feed} kg saves ₹{feedCost}/day in feed cost, which outweighs the revenue lost (-₹{rev}/day) from a {milk} L/day decline in milk yield, creating a net savings of +₹{net}/day."
          )
        );
      } else {
        return formatText(
          t(
            "sim.explain.feed_dec_milk_neg_loss",
            "Reducing feed by {feed} kg saves ₹{feedCost}/day in feed cost, but milk production drops by {milk} L/day (-₹{rev}/day revenue), causing an estimated net loss of -₹{net}/day."
          )
        );
      }
    }
  }
}

export function getLocalizedSimulationSummary(
  cowResult: CowWhatIfResponse,
  t: (key: string, fallback?: string) => string
): string {
  const parts: string[] = [];
  const delta = cowResult.delta_milk_yield_l;
  const pct = cowResult.percent_change;

  if (delta > 0) {
    parts.push(
      t(
        "sim.summary.yield_increase",
        "{name}'s predicted milk production increases by +{delta} L/day (+{pct}%) under this scenario."
      )
        .replace("{name}", cowResult.cow_name)
        .replace("{delta}", delta.toFixed(1))
        .replace("{pct}", pct.toFixed(1))
    );
  } else if (delta < 0) {
    parts.push(
      t(
        "sim.summary.yield_decrease",
        "{name}'s predicted milk production decreases by {delta} L/day ({pct}%) due to environmental heat stress."
      )
        .replace("{name}", cowResult.cow_name)
        .replace("{delta}", Math.abs(delta).toFixed(1))
        .replace("{pct}", pct.toFixed(1))
    );
  } else {
    parts.push(
      t(
        "sim.summary.yield_steady",
        "{name}'s predicted milk production remains steady at {yield} L/day."
      )
        .replace("{name}", cowResult.cow_name)
        .replace("{yield}", cowResult.simulated_milk_yield_l.toFixed(1))
    );
  }

  if (cowResult.simulated_thi >= 78.0) {
    parts.push(
      t(
        "sim.summary.thi_elevated",
        "Simulated THI ({thi}) places {name} in elevated thermal stress."
      )
        .replace("{name}", cowResult.cow_name)
        .replace("{thi}", cowResult.simulated_thi.toFixed(1))
    );

    const lowerSummary = (cowResult.explanation_summary || "").toLowerCase();
    if (lowerSummary.includes("active cooling")) {
      parts.push(
        t(
          "sim.summary.cooling_effective",
          "Active cooling reduces heat stress impact and recovers milk yield."
        )
      );
    } else if (lowerSummary.includes("adding cooling")) {
      parts.push(
        t(
          "sim.summary.cooling_recommended",
          "Adding cooling fans or shade is recommended to mitigate yield decline."
        )
      );
    }
  }

  return parts.length > 0 ? parts.join(" ") : cowResult.explanation_summary;
}
