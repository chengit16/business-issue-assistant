"""集中表达业务访问与人工确认规则，不接受客户端宣称的角色或验证事实。"""

from .commands import CaseChanges
from .errors import BusinessError
from .types import Actor, Publication, Role


def allow_business(actor: Actor, business: str) -> None:
    """拒绝可信身份业务范围以外的读写，材料、案例及分析复用此规则。"""
    if business not in actor.businesses:
        raise BusinessError("FORBIDDEN", "无权访问此业务的材料", 403)


def require_role(actor: Actor, *roles: Role) -> None:
    """在执行受限动作前验证服务端角色，界面入口可见性不授予权限。"""
    if actor.role not in roles:
        raise BusinessError("FORBIDDEN", "当前角色没有执行此操作的权限", 403)


def validate_case_change(
    actor: Actor, owner_id: str, current: Publication, changes: CaseChanges
) -> None:
    """验证编辑、发布与有效性变更所需角色，已验证状态必须有实际依据。"""
    if owner_id != actor.id:
        require_role(actor, "handler", "maintainer")
    if changes.publication in ("published", "archived") or current in ("published", "archived"):
        require_role(actor, "maintainer")
    if changes.validity == "verified":
        require_role(actor, "handler", "maintainer")
        if not changes.solution or not changes.verification or not changes.conditions:
            raise BusinessError(
                "VERIFICATION_REQUIRED", "验证方案前请填写适用条件、处理步骤及实际验证结果", 422
            )
    if changes.validity == "invalid":
        require_role(actor, "maintainer")
