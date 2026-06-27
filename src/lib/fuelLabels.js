export const fuelLabel = (dbType) =>
  dbType === 'PMA' || dbType === 'pma' ? 'Petrol' :
  dbType === 'AGO' || dbType === 'ago' ? 'Diesel' :
  String(dbType ?? '')
