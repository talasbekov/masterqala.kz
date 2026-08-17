'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Input,
  Select,
  SkeletonList,
  Table,
  type TableColumn,
} from '@masterqala/ui';
import {
  fetchOrders,
  fetchOrder,
  fetchCandidates,
  assignMaster,
  statusLabel,
  statusTone,
  STATUS_LABELS,
  PLANNED_STATUS_LABELS,
  TYPE_LABELS,
  type OrderListRow,
  type OrderDetail,
  type OrderType,
  type AssignCandidate,
} from '@/lib/orders';
import { AssignMasterDialog } from '@/components/AssignMasterDialog';
import { OrderDetailPanel } from '@/components/OrderDetailPanel';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

const TYPE_FILTERS: { value: OrderType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все типы' },
  { value: 'urgent', label: 'срочные' },
  { value: 'planned', label: 'плановые' },
];

function statusOptionsFor(type: OrderType | 'ALL'): { value: string; label: string }[] {
  if (type === 'urgent') return Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
  if (type === 'planned') return Object.entries(PLANNED_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  const merged = new Map<string, string>();
  Object.entries(STATUS_LABELS).forEach(([value, label]) => merged.set(value, label));
  Object.entries(PLANNED_STATUS_LABELS).forEach(([value, label]) => merged.set(value, label));
  return Array.from(merged.entries()).map(([value, label]) => ({ value, label }));
}

export default function OrdersPage() {
  const { refetch: refetchMetrics } = useOperatorMetrics();
  const [typeFilter, setTypeFilter] = useState<OrderType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState<{ id: string; type: OrderType } | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [candidates, setCandidates] = useState<AssignCandidate[] | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);

  function loadList() {
    setListLoading(true);
    fetchOrders({
      type: typeFilter === 'ALL' ? undefined : typeFilter,
      status: statusFilter || undefined,
      search: search.trim() || undefined,
    })
      .then((data) => {
        setRows(data);
        setListError('');
      })
      .catch((e) => setListError((e as Error).message))
      .finally(() => setListLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(loadList, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, search]);

  useEffect(() => {
    setStatusFilter('');
  }, [typeFilter]);

  const selectedRef = useRef<{ id: string; type: OrderType } | null>(null);
  selectedRef.current = selected;

  function loadDetail(target: { id: string; type: OrderType }) {
    setDetailLoading(true);
    fetchOrder(target.id, target.type)
      .then((data) => {
        if (selectedRef.current?.id !== target.id) return; // ответ на уже сброшенный выбор
        setDetail(data);
        setDetailError('');
      })
      .catch((e) => {
        if (selectedRef.current?.id !== target.id) return;
        setDetailError((e as Error).message);
      })
      .finally(() => {
        if (selectedRef.current?.id === target.id) setDetailLoading(false);
      });
  }

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    loadDetail(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function openAssignModal() {
    if (!selected) return;
    setAssignOpen(true);
    setAssignError('');
    setCandidates(null);
    setCandidatesLoading(true);
    try {
      const data = await fetchCandidates(selected.id);
      setCandidates(data);
    } catch (e) {
      setAssignError((e as Error).message);
    } finally {
      setCandidatesLoading(false);
    }
  }

  async function confirmAssign(masterUserId: string) {
    if (!selected) return;
    setAssigning(masterUserId);
    setAssignError('');
    try {
      await assignMaster(selected.id, masterUserId);
      setAssignOpen(false);
      setCandidates(null);
      loadDetail(selected);
      loadList();
      refetchMetrics();
    } catch (e) {
      setAssignError((e as Error).message);
    } finally {
      setAssigning(null);
    }
  }

  const columns: TableColumn<OrderListRow>[] = [
    {
      key: 'id',
      header: 'ID',
      width: '110px',
      cell: (row) => <span className="text-ink-soft">{row.id.slice(0, 8)}</span>,
    },
    { key: 'type', header: 'Тип', width: '100px', hideBelow: 'md', cell: (row) => TYPE_LABELS[row.type] },
    { key: 'client', header: 'Клиент', cell: (row) => <span className="font-bold">{row.client}</span> },
    {
      key: 'master',
      header: 'Мастер',
      hideBelow: 'lg',
      cell: (row) => <span className="text-ink-soft">{row.master ?? '—'}</span>,
    },
    {
      key: 'category',
      header: 'Категория',
      width: '150px',
      hideBelow: 'lg',
      cell: (row) => <span className="text-ink-soft">{row.category}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      width: '170px',
      cell: (row) => (
        <Badge tone={statusTone(row.type, row.status)}>{statusLabel(row.type, row.status)}</Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <h1 className="text-2xl font-extrabold text-ink">Заказы</h1>
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Тип заявки"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as OrderType | 'ALL')}
          fieldClassName="w-full sm:w-48"
        >
          {TYPE_FILTERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          label="Статус"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          fieldClassName="w-full sm:w-56"
        >
          <option value="">все статусы</option>
          {statusOptionsFor(typeFilter).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Input
          label="Поиск"
          type="search"
          hint="ID заказа или телефон клиента"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по ID заказа или телефону клиента"
          fieldClassName="w-full sm:w-80"
        />
      </div>
      {listError && <Alert tone="danger">{listError}</Alert>}

      {/* Ниже lg панель деталей уходит под таблицу: фиксированные 400px рядом с
          таблицей выдавливали страницу за край окна. */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          {listLoading ? (
            <SkeletonList rows={6} label="Загрузка списка заказов" />
          ) : rows.length === 0 ? (
            <EmptyState title="Ничего не найдено" subtitle="Измените фильтры или поисковый запрос." />
          ) : (
            <Card padding="none">
              <Table
                caption="Заказы: ID, тип, клиент, мастер, категория и статус. Нажатие на строку открывает карточку заказа"
                columns={columns}
                rows={rows}
                rowKey={(row) => `${row.type}-${row.id}`}
                onRowClick={(row) => setSelected({ id: row.id, type: row.type })}
                isRowSelected={(row) => selected?.id === row.id}
              />
            </Card>
          )}
        </div>

        <OrderDetailPanel
          selected={Boolean(selected)}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onAssignClick={openAssignModal}
        />
      </div>

      {assignOpen && (
        <AssignMasterDialog
          candidates={candidates}
          loading={candidatesLoading}
          error={assignError}
          assigning={assigning}
          onAssign={confirmAssign}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </div>
  );
}
