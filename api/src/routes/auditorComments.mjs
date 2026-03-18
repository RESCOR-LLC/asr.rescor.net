// ════════════════════════════════════════════════════════════════════
// Auditor Comments Route — auditor-specific commentary
// ════════════════════════════════════════════════════════════════════
// Auditors can attach comments to a review (and optionally to a
// specific question).  Only admins and auditors can create; admins
// can resolve.
// ════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authorize } from '../middleware/authorize.mjs';
import { verifyReviewTenant } from '../persistence/ReviewStore.mjs';

// ────────────────────────────────────────────────────────────────────
// createAuditorCommentsRouter
// ────────────────────────────────────────────────────────────────────

export function createAuditorCommentsRouter(database) {
  const router = Router();

  // ── Create auditor comment ─────────────────────────────────────
  router.post('/:reviewId/auditor-comments', authorize('admin', 'auditor'), async (request, response) => {
    let statusCode = 201;
    let body = null;
    const commentId = uuidv4();
    const now = new Date().toISOString();
    const author = request.user?.preferred_username || 'system';

    try {
      const isAdmin = (request.user?.roles || []).includes('admin');
      const ownedReview = await verifyReviewTenant(database, request.params.reviewId, request.user?.tenantId, isAdmin);

      if (!ownedReview) {
        statusCode = 404;
        body = { error: 'Review not found' };
        response.status(statusCode).json(body);
        return;
      }

      const { text, domainIndex, questionIndex } = request.body;
      const hasQuestion = domainIndex != null && questionIndex != null;

      let cypher;
      let parameters;

      if (hasQuestion) {
        cypher = `MATCH (review:Review {reviewId: $reviewId})
                  MATCH (question:Question {domainIndex: $domainIndex, questionIndex: $questionIndex})
                  CREATE (comment:AuditorComment {
                    commentId:  $commentId,
                    text:       $text,
                    author:     $author,
                    created:    $now,
                    resolved:   false,
                    resolvedBy: null,
                    resolvedAt: null
                  })
                  MERGE (review)-[:HAS_AUDITOR_COMMENT]->(comment)
                  MERGE (comment)-[:ON_QUESTION]->(question)
                  RETURN comment`;
        parameters = {
          reviewId: request.params.reviewId,
          commentId, text, author, now,
          domainIndex, questionIndex,
        };
      } else {
        cypher = `MATCH (review:Review {reviewId: $reviewId})
                  CREATE (comment:AuditorComment {
                    commentId:  $commentId,
                    text:       $text,
                    author:     $author,
                    created:    $now,
                    resolved:   false,
                    resolvedBy: null,
                    resolvedAt: null
                  })
                  MERGE (review)-[:HAS_AUDITOR_COMMENT]->(comment)
                  RETURN comment`;
        parameters = {
          reviewId: request.params.reviewId,
          commentId, text, author, now,
        };
      }

      const result = await database.query(cypher, parameters);
      body = result[0]?.comment || result[0] || null;
    } catch (error) {
      statusCode = 500;
      body = { error: error.message };
    }

    response.status(statusCode).json(body);
  });

  // ── List auditor comments for a review ─────────────────────────
  router.get('/:reviewId/auditor-comments', authorize('admin', 'auditor'), async (request, response) => {
    let statusCode = 200;
    let body = [];

    try {
      const isAdmin = (request.user?.roles || []).includes('admin');
      const ownedReview = await verifyReviewTenant(database, request.params.reviewId, request.user?.tenantId, isAdmin);

      if (!ownedReview) {
        statusCode = 404;
        body = { error: 'Review not found' };
        response.status(statusCode).json(body);
        return;
      }

      const result = await database.query(
        `MATCH (review:Review {reviewId: $reviewId})-[:HAS_AUDITOR_COMMENT]->(comment:AuditorComment)
         OPTIONAL MATCH (comment)-[:ON_QUESTION]->(question:Question)
         RETURN comment,
                question.domainIndex AS domainIndex,
                question.questionIndex AS questionIndex,
                question.text AS questionText
         ORDER BY comment.created DESC`,
        { reviewId: request.params.reviewId }
      );

      body = result.map((record) => ({
        ...record.comment,
        domainIndex: record.domainIndex ?? null,
        questionIndex: record.questionIndex ?? null,
        questionText: record.questionText || null,
      }));
    } catch (error) {
      statusCode = 500;
      body = { error: error.message };
    }

    response.status(statusCode).json(body);
  });

  // ── Resolve an auditor comment ─────────────────────────────────
  router.patch('/auditor-comments/:commentId/resolve', authorize('admin'), async (request, response) => {
    let statusCode = 200;
    let body = null;
    const now = new Date().toISOString();
    const resolvedBy = request.user?.preferred_username || 'system';

    try {
      const result = await database.query(
        `MATCH (comment:AuditorComment {commentId: $commentId})
         WHERE comment.resolved = false
         SET comment.resolved   = true,
             comment.resolvedBy = $resolvedBy,
             comment.resolvedAt = $now
         RETURN comment`,
        {
          commentId: request.params.commentId,
          resolvedBy,
          now,
        }
      );

      if (result.length === 0) {
        statusCode = 404;
        body = { error: 'Auditor comment not found or already resolved' };
      } else {
        body = result[0].comment || result[0];
      }
    } catch (error) {
      statusCode = 500;
      body = { error: error.message };
    }

    response.status(statusCode).json(body);
  });

  return router;
}
