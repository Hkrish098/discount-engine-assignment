from fastapi import APIRouter

from app.schemas import ParseRuleFailure, ParseRuleRequest, ParseRuleSuccess
from app.services.natural_language_parser import parse_natural_language_rule

router = APIRouter(prefix="/api", tags=["rules"])


@router.post(
    "/parse-rule",
    response_model=ParseRuleSuccess | ParseRuleFailure,
    summary="Parse a natural-language discount rule into a DiscountRule",
)
async def parse_rule(body: ParseRuleRequest) -> ParseRuleSuccess | ParseRuleFailure:
    return await parse_natural_language_rule(body.text)
