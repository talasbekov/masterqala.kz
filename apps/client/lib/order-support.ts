// Navigation context only. The order route/API remains responsible for access.
const ORDER_ID = /^[A-Za-z0-9-]{1,64}$/;

export function orderSupportHref(id: string): string {
  return ORDER_ID.test(id) ? `/support?${new URLSearchParams({orderId: id})}` : '/support';
}

export function supportOrderId(search: {getAll(name: string): string[]} | null): string | undefined {
  const ids = search?.getAll('orderId') ?? [];
  return ids.length === 1 && ORDER_ID.test(ids[0]) ? ids[0] : undefined;
}
