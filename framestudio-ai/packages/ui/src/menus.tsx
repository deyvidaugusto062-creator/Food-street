import type { ReactNode } from 'react';
import { ContextMenu as RCM, DropdownMenu as RDM } from 'radix-ui';
import { cx } from './primitives.tsx';

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  checked?: boolean;
}

const itemCls =
  'relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-sm text-fg outline-none data-[highlighted]:bg-accent/20 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40';
const contentCls = 'fs-pop z-[110] min-w-52 rounded-lg border border-line bg-panel-2 p-1 shadow-xl';

function Items({ items, Item, Sep }: { items: MenuItem[]; Item: typeof RCM.Item | typeof RDM.Item; Sep: typeof RCM.Separator | typeof RDM.Separator }) {
  return (
    <>
      {items.map((it, i) =>
        it.separator ? (
          <Sep key={i} className="my-1 h-px bg-line" />
        ) : (
          <Item key={i} disabled={it.disabled} onSelect={() => it.onSelect?.()} className={cx(itemCls, it.danger && 'text-danger')}>
            <span className="flex w-4 justify-center text-fg-muted">{it.checked ? '✓' : it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="text-[11px] text-fg-subtle">{it.shortcut}</span>}
          </Item>
        ),
      )}
    </>
  );
}

export function ContextMenu({ items, children }: { items: MenuItem[]; children: ReactNode }) {
  return (
    <RCM.Root>
      <RCM.Trigger asChild>{children}</RCM.Trigger>
      <RCM.Portal>
        <RCM.Content className={contentCls}>
          <Items items={items} Item={RCM.Item} Sep={RCM.Separator} />
        </RCM.Content>
      </RCM.Portal>
    </RCM.Root>
  );
}

export function DropdownMenu({ items, children, align = 'start' }: { items: MenuItem[]; children: ReactNode; align?: 'start' | 'end' | 'center' }) {
  return (
    <RDM.Root>
      <RDM.Trigger asChild>{children}</RDM.Trigger>
      <RDM.Portal>
        <RDM.Content className={contentCls} align={align} sideOffset={6}>
          <Items items={items} Item={RDM.Item} Sep={RDM.Separator} />
        </RDM.Content>
      </RDM.Portal>
    </RDM.Root>
  );
}
