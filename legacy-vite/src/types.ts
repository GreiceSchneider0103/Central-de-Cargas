export enum UserRole {
  ADMIN = 'ADMIN',
  STOCK_MANAGER = 'STOCK_MANAGER',
  ECOMMERCE_MANAGER = 'ECOMMERCE_MANAGER',
  SALESPERSON = 'SALESPERSON',
  OPERATOR = 'OPERATOR',
  FINANCE = 'FINANCE'
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId?: string;
  companyId?: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  active: boolean;
}

export interface DC {
  id: string;
  name: string;
  active: boolean;
}

export interface Store {
  id: string;
  name: string;
  active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  cnpj?: string;
  phone?: string;
  contactName?: string;
  active: boolean;
}

export enum ChannelType {
  MARKETPLACE_FULL = 'MARKETPLACE_FULL',
  LOJA_FISICA = 'LOJA_FISICA',
  TRANSFER_INTERNA = 'TRANSFER_INTERNA',
  OTHER = 'OTHER'
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  active: boolean;
}

export interface FullDestination {
  id: string;
  name: string;
  channelId: string;
  address?: string;
  defaultScheduleCode?: string;
  active: boolean;
}

export interface TransportType {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  cmv: number;
  supplierId?: string;
  active: boolean;
  lastSyncedAt: any;
}

export enum LoadPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum LoadStatus {
  PENDING = 'PENDING',
  ANALYSIS = 'ANALYSIS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ADJUSTMENT_REQUESTED = 'ADJUSTMENT_REQUESTED',
  TRANSFORMED_TO_LOAD = 'TRANSFORMED_TO_LOAD',
  CANCELLED = 'CANCELLED'
}

export enum LoadGeneralStatus {
  DRAFT = 'DRAFT',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  AWAITING_SUPPLIER = 'AWAITING_SUPPLIER',
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  AWAITING_RECEIVING = 'AWAITING_RECEIVING',
  PRODUCT_RECEIVED = 'PRODUCT_RECEIVED',
  PREPARING = 'PREPARING',
  SEPARATING = 'SEPARATING',
  LABELLING = 'LABELLING',
  AWAITING_NF = 'AWAITING_NF',
  READY_TO_SCHEDULE = 'READY_TO_SCHEDULE',
  SCHEDULED = 'SCHEDULED',
  READY_TO_COLLECT = 'READY_TO_COLLECT',
  LOADED = 'LOADED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
  WITH_DIVERGENCE = 'WITH_DIVERGENCE'
}

export interface LoadRequest {
  id: string;
  code: string;
  type: 'LOJA_FISICA' | 'FULL_MARKETPLACE';
  companyId: string;
  channelId: string;
  marketplaceId?: string;
  fullDestinationId?: string;
  targetStoreId?: string;
  priority: LoadPriority;
  desiredDate: any;
  status: LoadStatus;
  requesterId: string;
  observations?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Load {
  id: string;
  internalCode: string;
  marketplaceLoadNumber?: string;
  scheduleCode?: string;
  type: string;
  companyId: string;
  channelId: string;
  marketplaceId?: string;
  fullDestinationId?: string;
  targetStoreId?: string;
  originDcId?: string;
  status: LoadGeneralStatus;
  priority: LoadPriority;
  scheduledAt?: any;
  expectedReceivingDate?: any;
  actualReceivingDate?: any;
  collectionTypeId?: string;
  carrierId?: string;
  freightCost: number;
  otherCosts: number;
  estimatedRevenue: number;
  totalCmv: number;
  estimatedMarginValue: number;
  estimatedMarginPercent: number;
  requesterId: string;
  operationalResponsibleId?: string;
  observations?: string;
  createdAt: any;
  updatedAt: any;
}

export interface LoadItem {
  id: string;
  loadId: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  supplierOriginId: string;
  unitCmv: number;
  totalCmv: number;
  weight?: number;
  height?: number;
  width?: number;
  depth?: number;
  cubage?: number;
  expectedReceivingDate?: any;
  actualReceivingDate?: any;
  itemStatus?: string;
  observation?: string;
}

export interface LoadChecklist {
  id: string;
  loadId: string;
  orderPlaced: boolean;
  orderConfirmed: boolean;
  productReceived: boolean;
  mounted: boolean;
  scheduled: boolean;
  labelPrinted: boolean;
  separated: boolean;
  labelled: boolean;
  nfIssued: boolean;
  loaded: boolean;
  finished: boolean;
  updatedAt: any;
}
