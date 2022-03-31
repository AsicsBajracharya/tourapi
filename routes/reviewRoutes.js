const express = require("express");

const {
  getAllReviews,
  createReview,
  deleteReview,
  updateReview,
  setTourUserIds,
  getReview,
} = require("../controllers/reviewConttroller");

const authController = require("../controllers/authController");

const router = express.Router({
  mergeParams: true,
});

router.use(authController.protect);

router
  .route("/")
  .get(getAllReviews)
  .post(authController.restrictTo("user"), setTourUserIds, createReview);
router
  .route("/:id")
  .get(getReview)
  .delete(authController.restrictTo("user", "admin"), deleteReview)
  .patch(authController.restrictTo("user", "admin"), updateReview);

module.exports = router;
