const blockUser = (user) => {
  if (user?.isBlocked) {
    throw new Error(`${user?.firstName} - Bạn không thể đăng nhập do tài khoản của bạn đã bị chặn`);
  }
};

module.exports = blockUser;
