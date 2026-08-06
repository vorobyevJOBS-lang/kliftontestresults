-- EvidenceHire: allow a member to access an explicit set of branches.
-- Existing single-branch and owner access remains unchanged.
create table if not exists public.organization_member_branches (
  organization_id uuid not null,
  user_id uuid not null,
  branch_id text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, branch_id),
  foreign key (organization_id, user_id)
    references public.organization_members(organization_id, user_id) on delete cascade
);

alter table public.organization_member_branches enable row level security;
grant select on public.organization_member_branches to authenticated;

create or replace function public.is_org_owner(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.role::text = 'owner'
  )
$$;
revoke all on function public.is_org_owner(uuid) from public, anon;
grant execute on function public.is_org_owner(uuid) to authenticated;

drop policy if exists "members read own branch grants" on public.organization_member_branches;
create policy "members read own branch grants"
on public.organization_member_branches for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_org_owner(organization_id)
);

drop policy if exists "owners manage branch grants" on public.organization_member_branches;
create policy "owners manage branch grants"
on public.organization_member_branches for all to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create index if not exists organization_member_branches_user_idx
on public.organization_member_branches(user_id, organization_id, branch_id);

create or replace function public.can_access_branch(target_org uuid, target_branch text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = target_branch
        or exists(
          select 1 from public.organization_member_branches b
          where b.organization_id = m.organization_id
            and b.user_id = m.user_id
            and b.branch_id = target_branch
        )
      )
  )
$$;
revoke all on function public.can_access_branch(uuid,text) from public, anon;
grant execute on function public.can_access_branch(uuid,text) to authenticated;

create or replace function public.can_manage_assessment(target_assessment uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1
    from public.assessments a
    join public.organization_members m on m.organization_id = a.organization_id
    where a.id = target_assessment
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner','admin')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = a.branch_id
        or exists(
          select 1 from public.organization_member_branches b
          where b.organization_id = m.organization_id
            and b.user_id = m.user_id
            and b.branch_id = a.branch_id
        )
      )
  )
$$;
revoke all on function public.can_manage_assessment(uuid) from public, anon;
grant execute on function public.can_manage_assessment(uuid) to authenticated;
