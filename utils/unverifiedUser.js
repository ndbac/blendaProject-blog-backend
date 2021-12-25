const unverifiedUser = (user) => {
    if (!user?.isAccountVerified) {
      throw new Error(`Chào ${user?.lastName}, vui lòng xác minh tài khoản để có thể tạo bài viết!`);
    }
  };
  
  module.exports = unverifiedUser;
  