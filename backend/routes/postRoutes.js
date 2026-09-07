const express = require("express");
const mongoose = require("mongoose");

const Post = require("../models/Post");
const Comment = require("../models/Comment");
const protect = require("../middleware/authMiddleware");

const router = express.Router();


/* =========================================================
   CREATE POST
   POST /api/posts
========================================================= */

router.post("/", protect, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Post content is required.",
      });
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Post cannot exceed 2000 characters.",
      });
    }

    const post = await Post.create({
      author: req.user._id,
      content: trimmedContent,
    });

    const populatedPost = await Post.findById(post._id)
      .populate(
        "author",
        "username avatar bio college branch semester"
      );

    return res.status(201).json({
      success: true,
      message: "Post created successfully.",
      post: populatedPost,
    });
  } catch (error) {
    console.error("Create post error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create post.",
    });
  }
});


/* =========================================================
   GET FEED
   GET /api/posts
========================================================= */

router.get("/", protect, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate(
        "author",
        "username avatar bio college branch semester"
      )
      .sort({
        createdAt: -1,
      })
      .limit(50);

    return res.status(200).json({
      success: true,
      posts,
    });
  } catch (error) {
    console.error("Get posts error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load posts.",
    });
  }
});


/* =========================================================
   LIKE / UNLIKE POST
   POST /api/posts/:postId/like
========================================================= */

router.post("/:postId/like", protect, async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID.",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    const userId = req.user._id.toString();

    const alreadyLiked = post.likes.some(
      (id) => id.toString() === userId
    );

    if (alreadyLiked) {
      post.likes = post.likes.filter(
        (id) => id.toString() !== userId
      );
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();

    return res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likesCount: post.likes.length,
    });
  } catch (error) {
    console.error("Like post error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to like post.",
    });
  }
});


/* =========================================================
   DELETE POST
   DELETE /api/posts/:postId
========================================================= */

router.delete("/:postId", protect, async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID.",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    if (
      post.author.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own posts.",
      });
    }

    await Post.findByIdAndDelete(postId);

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully.",
    });
  } catch (error) {
    console.error("Delete post error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete post.",
    });
  }
});


/* =========================================================
   COMMENTS
========================================================= */

/*
  Create a comment
  POST /api/posts/:postId/comments
*/
router.post("/:postId/comments", protect, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID.",
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty.",
      });
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 500 characters.",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    const comment = await Comment.create({
      post: postId,
      author: req.user._id,
      content: trimmedContent,
    });

    await Post.findByIdAndUpdate(postId, {
  $inc: {
    commentsCount: 1,
  },
});

    const populatedComment = await Comment.findById(comment._id)
      .populate(
        "author",
        "username avatar bio college branch semester"
      );

    return res.status(201).json({
      success: true,
      message: "Comment added successfully.",
      comment: populatedComment,
    });
  } catch (error) {
    console.error("Create comment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to add comment.",
    });
  }
});


/*
  Get comments for a post
  GET /api/posts/:postId/comments
*/
router.get("/:postId/comments", protect, async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID.",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    const comments = await Comment.find({
      post: postId,
    })
      .populate(
        "author",
        "username avatar bio college branch semester"
      )
      .sort({
        createdAt: 1,
      });

    return res.status(200).json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error("Get comments error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load comments.",
    });
  }
});


/*
  Delete own comment
  DELETE /api/posts/:postId/comments/:commentId
*/
router.delete(
  "/:postId/comments/:commentId",
  protect,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(postId) ||
        !mongoose.Types.ObjectId.isValid(commentId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid post or comment ID.",
        });
      }

      const comment = await Comment.findOne({
        _id: commentId,
        post: postId,
      });

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found.",
        });
      }

      if (
        comment.author.toString() !==
        req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own comments.",
        });
      }

      await Comment.findByIdAndDelete(commentId);

      await Post.findByIdAndUpdate(postId, {
  $inc: {
    commentsCount: -1,
  },
});

      return res.status(200).json({
        success: true,
        message: "Comment deleted successfully.",
      });
    } catch (error) {
      console.error("Delete comment error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to delete comment.",
      });
    }
  }
);

module.exports = router;