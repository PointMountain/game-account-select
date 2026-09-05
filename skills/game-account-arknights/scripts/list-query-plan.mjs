function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function buildListQueryPlan({ platform, limit, batchCount, displayCount, detailCount }) {
  const normalizedLimit = Math.min(60, positiveInteger(limit, 20));
  const normalizedBatchCount = Math.min(3, positiveInteger(batchCount, 1));
  const candidateFloor = Math.max(
    5,
    positiveInteger(displayCount, 10),
    positiveInteger(detailCount, 10) * 2,
  );

  if (platform === 'pzds') {
    const perBatchLimit = Math.min(normalizedLimit, candidateFloor);
    return [{
      page: 1,
      limit: Math.min(60, perBatchLimit * normalizedBatchCount),
      logical_batch_count: normalizedBatchCount,
      strategy: 'single_accumulating_scan',
    }];
  }

  const pageSpan = Math.max(1, Math.ceil(normalizedLimit / 20));
  return Array.from({ length: normalizedBatchCount }, (_, batch) => ({
    page: 1 + batch * pageSpan,
    limit: normalizedLimit,
    logical_batch_count: 1,
    strategy: 'paged_requests',
  }));
}
