export type DisputeKind = 'orders' | 'planned-orders';
export class DisputeContextUnavailable extends Error {constructor(){super('The requested dispute context is unavailable');this.name='DisputeContextUnavailable';}}
export interface DisputeTarget {kind: DisputeKind; id: string}
export interface OrderDispute {
  id: string; orderId: string | null; plannedOrderId: string | null;
  status: 'OPEN' | 'RESOLVED'; reason: string; openedByUserId?: string;
  counterStatement: string | null; createdAt?: string | null; resolvedAt?: string | null;
  resolutionNote?: string | null; refundServiceFee?: boolean | null; penalizeMaster?: boolean | null;
}
export interface DisputeContext {
  id: string; status: string; clientId?: string; masterId?: string | null; closedAt?: string | null;
  description?: string | null; address?: string | null; dispute: OrderDispute | null;
  lifecycleVersion?: number; commercialMode?: string; quoteVersion?: number; quoteTotal?: number | null;
}
export interface DisputeEvidence {id: string; isMine: boolean; uploadedByUserId: string; mimeType: string; scanStatus: string; createdAt: string}
export interface DisputeSummary {id: string; orderId: string | null; plannedOrderId: string | null; status: 'OPEN' | 'RESOLVED'; reason: string; createdAt: string; resolvedAt: string | null}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonblank = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
export function parseOrderDispute(value: unknown, target: DisputeTarget): OrderDispute {
  if (!record(value) || !nonblank(value.id) || !['OPEN', 'RESOLVED'].includes(String(value.status)) || typeof value.reason !== 'string' || !(value.counterStatement === null || typeof value.counterStatement === 'string') || value[target.kind === 'orders' ? 'orderId' : 'plannedOrderId'] !== target.id) throw new Error('Invalid dispute response');
  if (value.openedByUserId !== undefined && !nonblank(value.openedByUserId)) throw new Error('Invalid dispute participant');
  if (['resolutionNote','createdAt','resolvedAt'].some(key=>value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string') || ['refundServiceFee','penalizeMaster'].some(key=>value[key] !== undefined && value[key] !== null && typeof value[key] !== 'boolean')) throw new Error('Invalid dispute metadata');
  return value as unknown as OrderDispute;
}
export function parseDisputeContext(value: unknown, target: DisputeTarget, expectedId?: string): DisputeContext {
  if (!record(value) || value.id !== target.id || !nonblank(value.status) || !('dispute' in value)) throw new Error('Invalid order context');
  if ((value.clientId !== undefined && !nonblank(value.clientId)) || (value.masterId !== undefined && value.masterId !== null && !nonblank(value.masterId)) || ['description','address','closedAt'].some(key=>value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string')) throw new Error('Invalid order participant or content');
  const dispute = value.dispute === null ? null : parseOrderDispute(value.dispute, target);
  if (expectedId && dispute?.id !== expectedId) throw new DisputeContextUnavailable();
  return {...value, dispute} as DisputeContext;
}
export function parseDisputeEvidence(value: unknown): DisputeEvidence[] {
  if (!Array.isArray(value) || !value.every(row => record(row) && nonblank(row.id) && typeof row.isMine === 'boolean' && nonblank(row.uploadedByUserId) && typeof row.mimeType === 'string' && typeof row.scanStatus === 'string' && typeof row.createdAt === 'string') || new Set(value.map(row => row.id)).size !== value.length) throw new Error('Invalid evidence response');
  return value;
}
export function parseDisputeSummaries(value: unknown): DisputeSummary[] {
  if (!Array.isArray(value) || !value.every(row => record(row) && nonblank(row.id) && typeof row.reason === 'string' && ['OPEN', 'RESOLVED'].includes(String(row.status)) && typeof row.createdAt === 'string' && ((nonblank(row.orderId) && row.plannedOrderId === null) || (nonblank(row.plannedOrderId) && row.orderId === null))) || new Set(value.map(row => row.id)).size !== value.length) throw new Error('Invalid dispute list');
  return value;
}
export function withinDisputeWindow(context: DisputeContext, now = Date.now()) {
  if (!['IN_PROGRESS', 'DONE', 'CLOSED'].includes(context.status)) return false;
  if (context.status !== 'CLOSED') return true;
  const closed = typeof context.closedAt === 'string' ? Date.parse(context.closedAt) : NaN;
  return Number.isFinite(closed) && now - closed <= 48 * 3600 * 1000;
}
export function disputeQuoteTotal(context: DisputeContext): number | null {
  return context.lifecycleVersion !== undefined && context.lifecycleVersion >= 2 && context.commercialMode === 'DIRECT_PAYMENT' && Number.isSafeInteger(context.quoteVersion) && (context.quoteVersion ?? 0) > 0 && typeof context.quoteTotal === 'number' && Number.isFinite(context.quoteTotal) && context.quoteTotal >= 0 ? context.quoteTotal : null;
}
