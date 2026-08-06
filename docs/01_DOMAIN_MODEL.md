# Ledger Domain Model

## Vehicle
- id
- make
- model
- year
- vin
- currentMileage

## ServiceEntry
- id
- vehicleId
- description
- date
- mileage

## MaintenanceItem
- id
- vehicleId
- name
- priority

## MaintenanceSchedule
- intervalMiles
- intervalMonths

## OdometerReading
- mileage
- date
