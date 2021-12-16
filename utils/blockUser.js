const blockUser = (user) => {
  if (user?.isBlocked) {
    throw new Error(`Access denied as ${user?.firstName} is blocked`);
  }
};

module.exports = blockUser;
