import React from 'react';
import {
  AccountBalance,
  Business,
  DirectionsBoat,
  Flight,
  Inventory2,
  LocalPostOffice,
  LocalShipping,
  Public,
  Store,
  Train,
  Warehouse,
  AirportShuttle
} from '@mui/icons-material';

const ICONS = {
  truck: LocalShipping,
  business: Business,
  flight: Flight,
  post: LocalPostOffice,
  customs: AccountBalance,
  warehouse: Warehouse,
  inventory: Inventory2,
  globe: Public,
  store: Store,
  ship: DirectionsBoat,
  train: Train,
  delivery: AirportShuttle
};

export const ENVIRONMENT_ICON_OPTIONS = [
  { value: 'truck', label: 'Truck' },
  { value: 'business', label: 'Business' },
  { value: 'flight', label: 'Airline' },
  { value: 'post', label: 'Post' },
  { value: 'customs', label: 'Customs' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'globe', label: 'Global' },
  { value: 'store', label: 'Store' },
  { value: 'ship', label: 'Ship' },
  { value: 'train', label: 'Train' },
  { value: 'delivery', label: 'Delivery' }
];

const EnvironmentIcon = ({ icon, ...props }) => {
  const Icon = ICONS[icon] || ICONS.business;
  return <Icon {...props} />;
};

export const getEnvironmentIconLabel = (icon) => (
  ENVIRONMENT_ICON_OPTIONS.find((option) => option.value === icon)?.label || 'Business'
);

export default EnvironmentIcon;
