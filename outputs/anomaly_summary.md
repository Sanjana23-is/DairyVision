# Anomaly Detection Summary
This report summarizes cattle anomaly detection based on milk yield, feed intake, THI, weight and age.
## Severity counts
- Normal: 1977
- Warning: 1002
- Critical: 21

## Key findings
- Extreme heat stress cases: 168
- Abnormal yield drop cases: 301
- Abnormal feed behaviour cases: 618
- Critical cases with extreme heat stress: 4

## Top critical cases
feature summary for top critical cases:
| Cattle_ID | milk_output | feed | thi | weight | age | issue_tags |
|---|---|---|---|---|---|---|
| COW00126 | 13.77 | 29.90 | 77.3 | 362.5 | 20 | abnormal yield drop |
| COW01971 | 12.95 | 20.30 | 88.3 | 662.3 | 111 | extreme heat stress, abnormal yield drop |
| COW00618 | 13.75 | 29.40 | 54.1 | 377.5 | 18 | abnormal yield drop |
| COW00706 | 27.52 | 30.20 | 46.5 | 775.0 | 12 | model anomaly |
| COW01493 | 11.69 | 22.90 | 39.5 | 348.7 | 47 | abnormal yield drop |
| COW02321 | 13.55 | 31.30 | 60.3 | 401.8 | 15 | abnormal yield drop, abnormal feed behaviour |
| COW01150 | 14.77 | 21.30 | 94.8 | 416.6 | 51 | extreme heat stress, abnormal yield drop |
| COW02016 | 13.97 | 26.60 | 80.4 | 379.0 | 56 | extreme heat stress, abnormal yield drop |
| COW02859 | 28.93 | 15.80 | 55.0 | 791.9 | 60 | abnormal feed behaviour |
| COW01537 | 27.24 | 31.20 | 39.7 | 736.5 | 23 | abnormal feed behaviour |
