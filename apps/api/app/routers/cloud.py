from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CloudLead
from ..ratelimit import cloud_interest_rate_limit
from ..schemas import CloudLeadRequest


# Public, unauthenticated: the marketing site's "Choose Cloud" CTA. There is
# no self-serve checkout yet, so this just records interest for the team to
# follow up with -- see the Cloud billing roadmap item.
public_router = APIRouter(prefix="/public", tags=["Public"])


@public_router.post("/cloud-interest", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(cloud_interest_rate_limit)])
def submit_cloud_interest(payload: CloudLeadRequest, db: Session = Depends(get_db)):
    db.add(CloudLead(name=payload.name, email=payload.email, agency_name=payload.agency_name))
    db.commit()
