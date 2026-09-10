/**
 * Live BSON shapes from Fixer_DB (sampled 2026-09-08).
 * Document layer = Date / ObjectId. HTTP JSON dates are cairo strings.
 * Do not use these types to coerce runtime values.
 */
import type { Types } from "mongoose";

export type ObjectId = Types.ObjectId;

export interface RepairingServiceLine {
  name?: string;
  price?: number;
  state?: string;
  _id?: ObjectId;
}

export interface RepairingAdditionLine {
  name?: string;
  price?: number;
  _id?: ObjectId;
}

export interface RepairingComponentLine {
  name?: string;
  quantity?: number;
  price?: number;
  _id?: ObjectId;
}

export interface RepairingTechnician {
  workerId?: ObjectId;
  name?: string;
}

/** Live: totalPrice is Int32 or String. receptionEngineer absent on old docs. */
export interface RepairingDoc {
  _id: ObjectId;
  client?: string;
  genId?: string;
  brand?: string;
  category?: string;
  model?: string;
  totalPrice?: number | string;
  carNumber?: string;
  type?: string;
  expectedDate?: Date;
  Services?: RepairingServiceLine[];
  additions?: RepairingAdditionLine[];
  component?: RepairingComponentLine[];
  discount?: number;
  priceAfterDiscount?: number;
  complete?: boolean;
  completedServicesRatio?: number;
  Note1?: string;
  Note2?: string;
  distance?: number;
  nextRepairDistance?: number;
  nextRepairDate?: Date;
  carId?: ObjectId;
  generatedCode?: string;
  technicians?: RepairingTechnician[];
  Reception?: string;
  receptionEngineer?: string | null;
  representative?: string | null;
  oldgenId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export interface InventoryDoc {
  _id: ObjectId;
  name?: string;
  quantity?: number;
  price?: number;
  Unit?: string;
  Code?: string;
  alertQuantity?: number;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export interface CarComponentState {
  component?: string;
  state?: string;
  details?: string;
  _id?: ObjectId;
}

export interface CarDoc {
  _id: ObjectId;
  ownerName?: string;
  image?: string;
  imagePublicId?: string;
  carNumber?: string;
  chassisNumber?: string;
  color?: string;
  State?: string;
  brand?: string;
  category?: string;
  model?: string;
  generatedCode?: string;
  generatedPassword?: string;
  nextRepairDate?: Date | null;
  lastRepairDate?: Date | null;
  periodicRepairs?: number;
  nonPeriodicRepairs?: number;
  componentState?: CarComponentState[];
  repairing?: boolean;
  distances?: number | null;
  motorNumber?: string;
  repairing_id?: ObjectId | null;
  completedServicesRatio?: number;
  nextRepairDistance?: number | null;
}

export interface UserCarEmbed {
  id?: ObjectId;
  carCode?: string;
  carNumber?: string;
  brand?: string;
  category?: string;
  model?: string;
  image?: string;
  imagePublicId?: string;
  _id?: ObjectId;
}

export interface UserDoc {
  _id: ObjectId;
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  active?: boolean;
  phoneNumber?: string;
  phone?: string;
  image?: string;
  imagePublicId?: string;
  profileImg?: string;
  slug?: string;
  car?: UserCarEmbed[];
  vertified?: boolean;
  fcmToken?: string | null;
  loginToken?: {
    token?: string | null;
    expiresAt?: Date | null;
  };
  passwordChangedAt?: Date;
  passwordResetCode?: string;
  passwordResetExpires?: Date;
  passwordResetVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export interface WorkerMoneyItem {
  amount?: number;
  date?: Date;
  _id?: ObjectId;
}

export interface WorkerDoc {
  _id: ObjectId;
  name?: string;
  phoneNumber?: string;
  jobTitle?: string;
  salary?: number;
  salaryAfterProcces?: number;
  salaryAfterReword?: number;
  IdNumber?: string;
  loans?: WorkerMoneyItem[];
  penalty?: WorkerMoneyItem[];
  reward?: WorkerMoneyItem[];
  numberOfRepairs?: number;
  generatedPassword?: string;
  roleId?: ObjectId | null;
  image?: string;
  imagePublicId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export interface MonthlyAddition {
  title?: string;
  price?: number;
  date?: Date;
  type?: "reward" | "penalty" | "null" | string;
  _id?: ObjectId;
}

export interface MonthlyMoneyReportDoc {
  _id: ObjectId;
  date?: Date;
  outCome?: number;
  encome?: number;
  totalGain?: number;
  additions?: MonthlyAddition[];
  electricity_bill?: number;
  water_bill?: number;
  gas_bill?: number;
  rent?: number;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export interface PasskeyDoc {
  _id: ObjectId;
  userId?: ObjectId;
  credentialId?: string;
  publicKey?: string;
  counter?: number;
  transports?: string[];
  aaguid?: string;
  label?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  __v?: number;
}

export interface AppVersionDoc {
  _id: ObjectId;
  version?: string;
  type?: string;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export interface CategoryDoc {
  _id: ObjectId;
  category?: string;
  code?: string;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export interface IssueDoc {
  _id: ObjectId;
  user_id?: ObjectId;
  platform?: string;
  app_type?: string;
  description?: string;
  solved?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export interface RoleDoc {
  _id: ObjectId;
  name?: string;
  isFullAccess?: boolean;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export interface RolePermissionDoc {
  _id: ObjectId;
  roleId?: ObjectId;
  permissionKey?: string;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

export interface PermissionEndpoint {
  method?: string;
  path?: string;
  params?: string[];
  _id?: ObjectId;
}

export interface PermissionDoc {
  _id: ObjectId;
  key?: string;
  label?: string;
  module?: string;
  endpoints?: PermissionEndpoint[];
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}
