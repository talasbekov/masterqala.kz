'use client';
import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  SkeletonList,
  Table,
  SearchIcon,
  type TableColumn,
} from '@masterqala/ui';
import { BlockUserDialog } from '@/components/BlockUserDialog';
import { fetchUsers, blockUser, unblockUser, type OperatorUserRow } from '@/lib/users';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<OperatorUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blockTarget, setBlockTarget] = useState<OperatorUserRow | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  async function load(currentSearch: string) {
    try {
      const data = await fetchUsers(currentSearch.trim() || undefined);
      setRows(data);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(search), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function confirmBlock() {
    if (!blockTarget || !reason.trim()) return;
    setSubmitting(true);
    try {
      await blockUser(blockTarget.id, reason.trim());
      setBlockTarget(null);
      setReason('');
      await load(search);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnblock(id: string) {
    setUnblockingId(id);
    try {
      await unblockUser(id);
      await load(search);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUnblockingId(null);
    }
  }

  const columns: TableColumn<OperatorUserRow>[] = [
    {
      key: 'name',
      header: 'Пользователь',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2 font-bold">
          {row.name ?? '—'}
          {row.isBlocked && <Badge tone="danger">заблокирован</Badge>}
        </span>
      ),
    },
    { key: 'phone', header: 'Телефон', cell: (row) => row.phone, width: '170px' },
    { key: 'role', header: 'Роль', cell: (row) => row.role, width: '140px', hideBelow: 'md' },
    {
      key: 'orders',
      header: 'Заказов',
      cell: (row) => row.orders,
      width: '100px',
      align: 'right',
      hideBelow: 'lg',
    },
    {
      key: 'actions',
      header: 'Действия',
      width: '170px',
      align: 'right',
      cell: (row) =>
        row.isBlocked ? (
          <Button
            variant="secondary"
            size="sm"
            loading={unblockingId === row.id}
            onClick={() => handleUnblock(row.id)}
          >
            Разблокировать
          </Button>
        ) : (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setBlockTarget(row);
              setReason('');
            }}
          >
            Заблокировать
          </Button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="text-2xl font-extrabold text-ink">Пользователи</h1>
        <Input
          label="Поиск по телефону или имени"
          labelHidden
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по телефону/имени"
          prefix={<SearchIcon size={18} />}
          fieldClassName="w-full sm:w-80"
        />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <SkeletonList rows={5} label="Загрузка списка пользователей" />
      ) : rows.length === 0 ? (
        <EmptyState title="Ничего не найдено" subtitle="Попробуйте изменить поисковый запрос." />
      ) : (
        <Card padding="none">
          <Table
            caption="Пользователи платформы: имя, телефон, роль, число заказов и блокировка"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
          />
        </Card>
      )}

      {blockTarget && (
        <BlockUserDialog
          target={blockTarget}
          reason={reason}
          onReasonChange={setReason}
          submitting={submitting}
          onConfirm={confirmBlock}
          onCancel={() => setBlockTarget(null)}
        />
      )}
    </div>
  );
}
