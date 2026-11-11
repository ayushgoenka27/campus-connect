"""
Posts API — Community Module (Phase 3)
Handles: Posts (CRUD + keyword search + batched aggregates), Comments (add/list/delete), Likes (toggle)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_user
from app.db.dependencies import get_db
from app.models.comment import Comment
from app.models.like import Like
from app.models.post import Post
from app.models.user import User
from app.schemas.post import (
    CommentListResponse,
    CommentResponse,
    CreateCommentRequest,
    CreatePostRequest,
    LikeResponse,
    PostAuthorInfo,
    PostListResponse,
    PostResponse,
    UpdatePostRequest,
)

router = APIRouter(prefix="/posts", tags=["Community"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_author(author: User) -> PostAuthorInfo:
    return PostAuthorInfo(
        id=author.id,
        full_name=author.full_name,
        username=author.username,
        profile_image=author.profile_image,
        course=author.course,
        branch=author.branch,
    )


def _build_post_responses(
    posts: list[Post], current_user_id: int, db: Session
) -> list[PostResponse]:
    """Construct PostResponse items using batched aggregate queries (no N+1)."""
    if not posts:
        return []

    post_ids = [post.id for post in posts]

    like_counts = dict(
        db.execute(
            select(Like.post_id, func.count(Like.id))
            .where(Like.post_id.in_(post_ids))
            .group_by(Like.post_id)
        ).all()
    )

    comment_counts = dict(
        db.execute(
            select(Comment.post_id, func.count(Comment.id))
            .where(Comment.post_id.in_(post_ids))
            .group_by(Comment.post_id)
        ).all()
    )

    liked_post_ids = set(
        db.scalars(
            select(Like.post_id).where(
                Like.post_id.in_(post_ids),
                Like.user_id == current_user_id,
            )
        ).all()
    )

    return [
        PostResponse(
            id=post.id,
            content=post.content,
            image_url=post.image_url,
            author=_serialize_author(post.author),
            like_count=like_counts.get(post.id, 0),
            comment_count=comment_counts.get(post.id, 0),
            is_liked=post.id in liked_post_ids,
            created_at=post.created_at,
            updated_at=post.updated_at,
        )
        for post in posts
    ]


def _get_post_or_404(post_id: int, db: Session) -> Post:
    post = db.scalar(
        select(Post).options(joinedload(Post.author)).where(Post.id == post_id)
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


# ---------------------------------------------------------------------------
# POST /posts — Create a post
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new community post",
)
def create_post(
    body: CreatePostRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostResponse:
    post = Post(
        author_id=current_user.id,
        content=body.content,
        image_url=body.image_url,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    post = _get_post_or_404(post.id, db)
    return _build_post_responses([post], current_user.id, db)[0]


# ---------------------------------------------------------------------------
# GET /posts — List posts (paginated, keyword-searchable, newest first)
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=PostListResponse,
    summary="List community posts (paginated, keyword searchable, newest first)",
)
def list_posts(
    search: str | None = Query(default=None, max_length=200),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostListResponse:
    search_term = search.strip() if search else None

    count_stmt = select(func.count()).select_from(Post)
    posts_stmt = select(Post).options(joinedload(Post.author))

    if search_term:
        pattern = f"%{search_term}%"
        count_stmt = count_stmt.where(Post.content.ilike(pattern))
        posts_stmt = posts_stmt.where(Post.content.ilike(pattern))

    total = db.scalar(count_stmt) or 0

    posts = list(
        db.scalars(
            posts_stmt
            .order_by(Post.created_at.desc(), Post.id.desc())
            .offset(skip)
            .limit(limit)
        ).all()
    )

    return PostListResponse(
        posts=_build_post_responses(posts, current_user.id, db),
        total=total,
    )


# ---------------------------------------------------------------------------
# GET /posts/{post_id} — Get a single post
# ---------------------------------------------------------------------------

@router.get(
    "/{post_id}",
    response_model=PostResponse,
    summary="Get a single post by ID",
)
def get_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostResponse:
    post = _get_post_or_404(post_id, db)
    return _build_post_responses([post], current_user.id, db)[0]


# ---------------------------------------------------------------------------
# PATCH /posts/{post_id} — Update own post
# ---------------------------------------------------------------------------

@router.patch(
    "/{post_id}",
    response_model=PostResponse,
    summary="Update your own post",
)
def update_post(
    post_id: int,
    body: UpdatePostRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostResponse:
    post = _get_post_or_404(post_id, db)
    if post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own posts",
        )

    if "content" in body.model_fields_set and body.content is not None:
        post.content = body.content
    if "image_url" in body.model_fields_set:
        post.image_url = body.image_url

    db.commit()
    db.refresh(post)
    post = _get_post_or_404(post.id, db)
    return _build_post_responses([post], current_user.id, db)[0]


# ---------------------------------------------------------------------------
# DELETE /posts/{post_id} — Delete own post
# ---------------------------------------------------------------------------

@router.delete(
    "/{post_id}",
    summary="Delete your own post",
)
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    post = _get_post_or_404(post_id, db)
    if post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own posts",
        )
    db.delete(post)
    db.commit()
    return {"message": "Post deleted successfully"}


# ---------------------------------------------------------------------------
# POST /posts/{post_id}/comments — Add a comment
# ---------------------------------------------------------------------------

@router.post(
    "/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment to a post",
)
def add_comment(
    post_id: int,
    body: CreateCommentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentResponse:
    _get_post_or_404(post_id, db)

    comment = Comment(
        post_id=post_id,
        author_id=current_user.id,
        content=body.content.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    comment = db.scalar(
        select(Comment)
        .options(joinedload(Comment.author))
        .where(Comment.id == comment.id)
    )

    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        content=comment.content,
        author=_serialize_author(comment.author),
        created_at=comment.created_at,
    )


# ---------------------------------------------------------------------------
# GET /posts/{post_id}/comments — List comments on a post
# ---------------------------------------------------------------------------

@router.get(
    "/{post_id}/comments",
    response_model=CommentListResponse,
    summary="List comments on a post (oldest first)",
)
def list_comments(
    post_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentListResponse:
    _get_post_or_404(post_id, db)

    total = db.scalar(
        select(func.count()).where(Comment.post_id == post_id)
    ) or 0

    comments = db.scalars(
        select(Comment)
        .options(joinedload(Comment.author))
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
        .offset(skip)
        .limit(limit)
    ).all()

    return CommentListResponse(
        comments=[
            CommentResponse(
                id=c.id,
                post_id=c.post_id,
                content=c.content,
                author=_serialize_author(c.author),
                created_at=c.created_at,
            )
            for c in comments
        ],
        total=total,
    )


# ---------------------------------------------------------------------------
# DELETE /posts/comments/{comment_id} — Delete own comment
# ---------------------------------------------------------------------------

@router.delete(
    "/comments/{comment_id}",
    summary="Delete your own comment",
)
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    comment = db.scalar(select(Comment).where(Comment.id == comment_id))
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own comments",
        )
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted successfully"}


# ---------------------------------------------------------------------------
# POST /posts/{post_id}/like — Toggle like/unlike
# ---------------------------------------------------------------------------

@router.post(
    "/{post_id}/like",
    response_model=LikeResponse,
    summary="Toggle like/unlike on a post",
)
def toggle_like(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LikeResponse:
    _get_post_or_404(post_id, db)

    existing_like = db.scalar(
        select(Like).where(Like.post_id == post_id, Like.user_id == current_user.id)
    )

    if existing_like:
        db.delete(existing_like)
        db.commit()
        liked = False
        message = "Post unliked"
    else:
        new_like = Like(post_id=post_id, user_id=current_user.id)
        db.add(new_like)
        db.commit()
        liked = True
        message = "Post liked"

    like_count = db.scalar(
        select(func.count()).where(Like.post_id == post_id)
    ) or 0

    return LikeResponse(message=message, liked=liked, like_count=like_count)
