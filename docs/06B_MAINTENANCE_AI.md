# 06B_MAINTENANCE_AI

> Version: 0.1

## Goal
Reduce setup friction and improve maintenance plans over time.

## AI Use Cases

### Suggest Maintenance Items
After adding a vehicle:
- Oil
- Transmission Fluid
- Brake Fluid
- Coolant
- Filters
- Tires

### Suggest Intervals
Recommend schedule based on vehicle and source.

### Detect Missing Items
Example:
'You log brake work but have no brake inspection schedule.'

### Learn Preferences
Example:
'You consistently change oil around 4,800 miles. Update interval?'

## Data Sent
- Year
- Make
- Model
- Existing maintenance plan
- Limited service history

## Output
Structured suggestions only.

## Rules
- Never auto-add
- Never overwrite
- Always require user approval

## Acceptance Criteria
- Suggestions after vehicle creation
- Editable before saving
- Can be ignored
