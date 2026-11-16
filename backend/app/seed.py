"""显式导入虚构演示案例，重复执行不会产生重复数据。"""

from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from .config import settings
from .db import SessionLocal
from .main import bootstrap_admin
from .models import Case, CaseRevision, Source, User
from .services import record_dict

EXAMPLES = [
    {
        "title": "客户已扣款，订单仍显示待支付",
        "business": "订单售后",
        "symptom": "支付渠道显示扣款成功，商城订单在刷新后仍处于待支付状态。",
        "conditions": "演示商城 · 渠道甲 · 支付完成后 10 分钟内，需技术支持核对流水",
        "investigation": "客服确认订单号及支付时间，技术支持核对订单与渠道流水。",
        "cause": "本虚构样例设定为支付结果同步延迟，实际问题需独立确认。",
        "solution": "1. 收集订单号、支付时间和渠道。\n2. 由有权限的技术支持核对支付流水与回调记录。\n3. 根据内部流程处理并确认订单最终状态。",
        "verification": "虚构演示记录，演示处理人核对状态恢复。本记录仅用于演示案例检索与发布流程。",
    },
    {
        "title": "退款已提交，客户暂未收到到账通知",
        "business": "订单售后",
        "symptom": "后台退款记录为处理中，客户询问到账进度。",
        "conditions": "演示商城 · 原路退款 · 仍在渠道约定处理时间内",
        "investigation": "核对退款单号、提交时间及渠道返回状态。",
        "cause": "虚构样例中的退款正在渠道侧处理中。",
        "solution": "核对退款记录与渠道状态，按实际渠道时效反馈进度，超过约定时间交由处理人跟进。",
        "verification": "虚构演示记录，演示处理人确认最终到账，仅用于演示。",
    },
    {
        "title": "优惠券达到金额门槛，结算时仍不可用",
        "business": "营销活动",
        "symptom": "购物车总金额达到门槛，但结算页提示优惠券不可用。",
        "conditions": "演示活动 · 指定商品券 · 以活动规则中参与商品金额为准",
        "investigation": "运营核对参与商品、有效期及可叠加规则。",
        "cause": "虚构样例中部分商品未参加活动。",
        "solution": "核对券的有效期和适用商品，再比较参与活动商品金额与门槛，向客户说明实际规则。",
        "verification": "虚构演示记录，演示运营确认适用商品范围，仅用于演示。",
    },
    {
        "title": "后台可以登录，但页面提示没有操作权限",
        "business": "系统支持",
        "symptom": "同事登录成功后，访问业务页面时提示权限不足。",
        "conditions": "演示管理后台 · 新开通账号 · 由系统管理员核对业务角色",
        "investigation": "检查账号所属团队与业务角色，核对页面要求的权限。",
        "cause": "虚构样例中尚未分配对应业务角色。",
        "solution": "确认账号和所需业务范围，交由管理员按授权流程核对角色，调整后重新登录验证。",
        "verification": "虚构演示记录，演示管理员完成角色核对，仅用于演示。",
    },
]


def seed():
    """按固定编号显式写入虚构演示案例，重复执行保留已有数据。"""
    bootstrap_admin()
    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.email == settings.admin_email))
        count = 0
        for example in EXAMPLES:
            case_id = str(uuid5(NAMESPACE_URL, "business-issue-demo/" + example["title"]))
            if db.get(Case, case_id):
                continue
            source = Source(
                business=example["business"],
                owner_id=admin.id,
                text="【虚构演示材料】\n" + example["symptom"] + "\n" + example["solution"],
            )
            db.add(source)
            db.flush()
            item = Case(
                id=case_id,
                **example,
                source_id=source.id,
                owner_id=admin.id,
                verified_by=admin.id,
                publication="published",
                validity="verified",
                is_demo=True,
            )
            db.add(item)
            db.flush()
            db.add(
                CaseRevision(
                    case_id=item.id, version=1, snapshot=record_dict(item), editor_id=admin.id
                )
            )
            count += 1
        db.commit()
        print(f"已新增 {count} 条虚构演示案例，演示案例均带有明确标记。")


if __name__ == "__main__":
    seed()
