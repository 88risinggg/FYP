function getCompanyId(req) {
  const value = Number(req?.user?.companyId);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function companyWhere(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}company_id = ?`;
}

module.exports = {
  companyWhere,
  getCompanyId
};
