import warnings
warnings.filterwarnings('ignore')
import logging
logging.getLogger().setLevel(logging.WARNING)

from data_loader import load_and_prepare
from feature_engineering import build_features, thi_stress_label

print('Testing updated seasonal weather generation...')
print('=' * 75)

df_clean = load_and_prepare()
df_full, X, y = build_features(df_clean, base_temp=28.0, base_hum=65.0)

# Analyze weather and THI
temps = df_full['temperature']
humidity = df_full['humidity']
thi = df_full['thi']
stress = thi_stress_label(thi)

print(f'\nWeather Statistics:')
print(f'  Temperature: {temps.min():.1f}-{temps.max():.1f}C (mean {temps.mean():.1f}±{temps.std():.1f})')
print(f'  Humidity:    {humidity.min():.1f}-{humidity.max():.1f}% (mean {humidity.mean():.1f}±{humidity.std():.1f})')

print(f'\nTHI Statistics:')
print(f'  THI Range:   {thi.min():.2f}-{thi.max():.2f} (mean {thi.mean():.2f}±{thi.std():.2f})')

print(f'\nStress Distribution:')
stress_dist = stress.value_counts().sort_index()
for cat, count in stress_dist.items():
    pct = (count / len(stress)) * 100
    bar = '█' * int(pct / 2)
    print(f'  {cat:<12}: {count:>5} ({pct:>6.2f}%) {bar}')

print(f'\nTarget vs Actual:')
for cat, target_range in [('No Stress', '60-70'), ('Mild', '15-20'), ('Moderate', '10-15'), ('Severe', '5-10')]:
    actual_pct = stress_dist.get(cat, 0) / len(stress) * 100
    status = 'OK' if (cat == 'No Stress' and 60 <= actual_pct <= 70) or \
                     (cat == 'Mild' and 15 <= actual_pct <= 20) or \
                     (cat == 'Moderate' and 10 <= actual_pct <= 15) or \
                     (cat == 'Severe' and 5 <= actual_pct <= 10) else 'CHECK'
    print(f'  {cat:<12}: {target_range}% target → {actual_pct:>6.2f}% actual [{status}]')
